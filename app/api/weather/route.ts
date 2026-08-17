import { NextRequest, NextResponse } from "next/server";
import { withX402FromHTTPServer, x402HTTPResourceServer, type RouteConfig } from "@x402/next";
import { declareDiscoveryExtension } from "@x402/extensions/bazaar";
import { declareOfferReceiptExtension } from "@x402/extensions/offer-receipt";
import { server, evmAddress, svmAddress, EVM_NETWORK, SVM_NETWORK } from "../../../proxy";

// Real, live weather — no API key required. Open-Meteo is free for
// non-commercial / low-volume use (see https://open-meteo.com/en/pricing);
// this route resells its data behind a $0.001 x402 paywall, so if call
// volume ever gets meaningful, swap in a licensed commercial weather
// provider (OpenWeatherMap, WeatherAPI.com, Tomorrow.io, etc.) instead of
// leaning on Open-Meteo's free tier at scale.
const GEOCODE_URL = "https://geocoding-api.open-meteo.com/v1/search";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const DEFAULT_CITY = "New York";

// WMO weather interpretation codes (used by Open-Meteo) -> plain-English
// condition. See https://open-meteo.com/en/docs#weathervariables
const WMO_CONDITIONS: Record<number, string> = {
  0: "clear sky",
  1: "mainly clear",
  2: "partly cloudy",
  3: "overcast",
  45: "fog",
  48: "depositing rime fog",
  51: "light drizzle",
  53: "moderate drizzle",
  55: "dense drizzle",
  56: "light freezing drizzle",
  57: "dense freezing drizzle",
  61: "slight rain",
  63: "moderate rain",
  65: "heavy rain",
  66: "light freezing rain",
  67: "heavy freezing rain",
  71: "slight snow fall",
  73: "moderate snow fall",
  75: "heavy snow fall",
  77: "snow grains",
  80: "slight rain showers",
  81: "moderate rain showers",
  82: "violent rain showers",
  85: "slight snow showers",
  86: "heavy snow showers",
  95: "thunderstorm",
  96: "thunderstorm with slight hail",
  99: "thunderstorm with heavy hail",
};

function conditionFor(code: number): string {
  return WMO_CONDITIONS[code] ?? `unknown (WMO code ${code})`;
}

type GeocodeResult = { name: string; latitude: number; longitude: number; country?: string; admin1?: string };

class WeatherLookupError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

async function geocodeCity(city: string): Promise<GeocodeResult> {
  const url = new URL(GEOCODE_URL);
  url.searchParams.set("name", city);
  url.searchParams.set("count", "1");
  url.searchParams.set("language", "en");
  url.searchParams.set("format", "json");

  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) {
    throw new WeatherLookupError(`Geocoding service returned ${res.status}`, 502);
  }
  const data = (await res.json()) as { results?: GeocodeResult[] };
  const first = data.results?.[0];
  if (!first) {
    throw new WeatherLookupError(`No location found matching "${city}"`, 404);
  }
  return first;
}

async function fetchCurrentWeather(latitude: number, longitude: number) {
  const url = new URL(FORECAST_URL);
  url.searchParams.set("latitude", String(latitude));
  url.searchParams.set("longitude", String(longitude));
  url.searchParams.set(
    "current",
    "temperature_2m,relative_humidity_2m,apparent_temperature,weather_code,wind_speed_10m",
  );
  url.searchParams.set("temperature_unit", "fahrenheit");
  url.searchParams.set("wind_speed_unit", "mph");
  url.searchParams.set("timezone", "auto");

  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) {
    throw new WeatherLookupError(`Forecast service returned ${res.status}`, 502);
  }
  const data = (await res.json()) as {
    current: {
      time: string;
      temperature_2m: number;
      apparent_temperature: number;
      relative_humidity_2m: number;
      weather_code: number;
      wind_speed_10m: number;
    };
  };
  return data.current;
}

type WeatherResponse = {
  location: string;
  observedAt: string;
  report: {
    weather: string;
    temperature: number;
    feelsLike: number;
    humidityPercent: number;
    windMph: number;
  };
  source: string;
};

type WeatherErrorResponse = { error: string };

const handler = async (request: NextRequest): Promise<NextResponse<WeatherResponse>> => {
  const city = request.nextUrl.searchParams.get("city")?.trim() || DEFAULT_CITY;

  // Any thrown error here means the handler returns a non-2xx status, which
  // means withX402 never settles the payment (see comment below) — a buyer
  // is never charged for a lookup that failed.
  const place = await geocodeCity(city);
  const current = await fetchCurrentWeather(place.latitude, place.longitude);

  const locationLabel = [place.name, place.admin1, place.country].filter(Boolean).join(", ");

  return NextResponse.json({
    location: locationLabel,
    observedAt: current.time,
    report: {
      weather: conditionFor(current.weather_code),
      temperature: Math.round(current.temperature_2m),
      feelsLike: Math.round(current.apparent_temperature),
      humidityPercent: Math.round(current.relative_humidity_2m),
      windMph: Math.round(current.wind_speed_10m),
    },
    source: "open-meteo.com",
  });
};

// withX402 settles the payment only after `handler` returns a successful
// (status < 400) response, giving you precise control over when payment is
// captured relative to your own business logic. Here that means a bad city
// name or an upstream outage (WeatherLookupError, caught below and turned
// into a 404/502) never gets charged.
const wrappedHandler = async (
  request: NextRequest,
): Promise<NextResponse<WeatherResponse | WeatherErrorResponse>> => {
  try {
    return await handler(request);
  } catch (err) {
    const status = err instanceof WeatherLookupError ? err.status : 502;
    const message = err instanceof Error ? err.message : "Unknown error fetching weather data";
    return NextResponse.json({ error: message }, { status });
  }
};

// withX402() always registers its route under a hardcoded "*" wildcard key
// internally, which the Bazaar extension then reports as routeTemplate
// ":var1" — mismatching our real (literal, param-free) resource URL and
// failing third-party validators like agentic.market's. Using
// withX402FromHTTPServer with the actual pathname as the route key avoids
// the wildcard entirely, so the SDK correctly omits routeTemplate instead
// of emitting a mismatching placeholder.
const weatherRouteConfig: RouteConfig = {
    accepts: [
      {
        scheme: "exact",
        price: "$0.001",
        network: EVM_NETWORK, // Base mainnet on X402_NETWORK=mainnet, else Base Sepolia
        payTo: evmAddress,
      },
      {
        scheme: "exact",
        price: "$0.001",
        network: SVM_NETWORK, // Solana mainnet-beta on X402_NETWORK=mainnet, else Devnet
        payTo: svmAddress,
      },
    ],
    // Must be an absolute https:// URL — the Bazaar discovery extension
    // rejects registration otherwise ("resource must start with 'https://'
    // when protocol type is http").
    resource: "https://x402tap.com/api/weather",
    description: "Live current weather conditions for any city, sourced from Open-Meteo",
    mimeType: "application/json",
    // Catalog metadata (see docs.x402.org/extensions/bazaar#quickstart-for-sellers):
    // serviceName/tags/iconUrl are what a buyer or agent actually sees when
    // browsing/filtering the Bazaar, separate from the input/output schema
    // below that tells them how to call it.
    serviceName: "x402 Weather API",
    tags: ["weather", "forecast", "api", "data", "live"],
    iconUrl: "https://x402tap.com/icon.png",
    extensions: {
      // Lists this route in the Bazaar catalog (see proxy.ts) so buyers and
      // agents can find and call it without reading docs first.
      ...declareDiscoveryExtension({
        input: { city: "Austin" },
        inputSchema: {
          properties: {
            city: { type: "string", description: "City name to fetch live current weather for (defaults to New York)" },
          },
        },
        output: {
          example: {
            location: "Austin, Texas, United States",
            observedAt: "2026-08-15T12:00",
            report: {
              weather: "partly cloudy",
              temperature: 91,
              feelsLike: 94,
              humidityPercent: 48,
              windMph: 7,
            },
            source: "open-meteo.com",
          },
        },
      }),
      // Signs an offer on the 402 and a receipt on success (see proxy.ts) —
      // includeTxHash makes receipts independently verifiable on-chain.
      ...declareOfferReceiptExtension({ includeTxHash: true }),
    },
};

const weatherHttpServer = new x402HTTPResourceServer(server, { "/api/weather": weatherRouteConfig });
export const GET = withX402FromHTTPServer(wrappedHandler, weatherHttpServer);

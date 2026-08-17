"use client";

import { motion, type Variants } from "framer-motion";
import EndpointCard, { type Endpoint } from "./EndpointCard";

const containerVariants: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
    },
  },
};

export default function EndpointGrid({ endpoints, flagship = false }: { endpoints: Endpoint[]; flagship?: boolean }) {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
    >
      {endpoints.map((endpoint) => (
        <EndpointCard key={endpoint.path} endpoint={endpoint} flagship={flagship} />
      ))}
    </motion.div>
  );
}

// Lightweight entrance animation used across the suite — cards fade + rise in,
// lightly staggered by index. Same "Reveal" idea we used on Run Track.
import { motion } from "framer-motion";

export function Reveal({ children, i = 0, style }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: Math.min(i * 0.05, 0.3), ease: [0.22, 1, 0.36, 1] }}
      style={style}
    >
      {children}
    </motion.div>
  );
}

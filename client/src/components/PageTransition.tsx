import { motion } from "framer-motion";
import { useLocation } from "wouter";

interface PageTransitionProps {
  children: React.ReactNode;
}

export default function PageTransition({ children }: PageTransitionProps) {
  const [location] = useLocation();
  
  return (
    <motion.div
      key={location}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ 
        duration: 0.2,
        ease: "easeOut"
      }}
      className="h-full"
    >
      {children}
    </motion.div>
  );
}

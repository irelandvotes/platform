"use client";

import { useEffect, useState } from "react";

export default function useBreakpoint() {
  const [width, setWidth] = useState(0);

  useEffect(() => {
    const handle = () => setWidth(window.innerWidth);

    handle();
    window.addEventListener("resize", handle);

    return () => window.removeEventListener("resize", handle);
  }, []);

  return {
    isMobile: width < 768,
    isTablet: width >= 768 && width < 1100,
    isLaptop: width >= 1100 && width < 1400,
    isDesktop: width >= 1400
  };
}
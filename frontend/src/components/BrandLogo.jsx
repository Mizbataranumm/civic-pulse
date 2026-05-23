import React from "react";

export default function BrandLogo({ size = "md", className = "" }) {
  const sizeClass = size === "lg" ? "w-10 h-10" : size === "sm" ? "w-8 h-8" : "w-9 h-9";

  return (
    <img
      src="/civicpulse-logo.png"
      alt="CivicPulse"
      className={`${sizeClass} rounded-lg object-cover shadow-[0_0_18px_rgba(6,182,212,0.25)] ${className}`}
    />
  );
}

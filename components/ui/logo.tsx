import React from 'react'

export function Logo({ className = "", size = 40 }: { className?: string; size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <circle
        cx="50"
        cy="50"
        r="45"
        className="stroke-primary"
        strokeWidth="8"
        strokeLinecap="round"
        strokeDasharray="30 15"
      />
      <path
        d="M35 50 L50 65 L65 35"
        className="stroke-primary"
        strokeWidth="8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle
        cx="50"
        cy="50"
        r="20"
        className="fill-primary/20"
      />
    </svg>
  )
}

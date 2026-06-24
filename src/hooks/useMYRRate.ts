"use client";
import { useEffect, useState } from "react";

export function useMYRRate(): number | null {
  const [rate, setRate] = useState<number | null>(null);
  useEffect(() => {
    fetch("/api/currency-rates")
      .then(r => r.json())
      .then(data => { if (data.rates?.MYR) setRate(data.rates.MYR); })
      .catch(() => {});
  }, []);
  return rate;
}

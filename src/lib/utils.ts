import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency, maximumFractionDigits: 0 }).format(value)
}

export function formatCompact(value: number, currency = 'EUR'): string {
  const abs = Math.abs(value)
  const sign = value < 0 ? '-' : ''
  const sym = currency === 'GBP' ? '£' : '€'
  if (abs >= 1_000_000) return `${sign}${sym}${(abs / 1_000_000).toFixed(1)}M`
  if (abs >= 1_000) return `${sign}${sym}${(abs / 1_000).toFixed(0)}K`
  return `${sign}${sym}${abs.toFixed(0)}`
}

export function varianceColor(variance: number): string {
  if (variance > 0.02) return 'text-red-600'   // over budget
  if (variance < -0.02) return 'text-green-600' // under budget
  return 'text-slate-600'                       // on track
}

export function formatPercent(value: number): string {
  return `${value.toFixed(1)}%`
}

export type RAGColor = 'Green' | 'Amber' | 'Red' | 'Grey' | 'Blue'

export const ragColorMap: Record<RAGColor, string> = {
  Green: '#70AD47',
  Amber: '#FFC000', 
  Red: '#E8766A',
  Grey: '#A6A6A6',
  Blue: '#5B9BD5'
}

export type Filters = {
  province: string | null
  district: string | null
  ugel: string | null
  levels: string[]
  managements: string[]
  areas: string[]
}

export type Meta = {
  years: number[]
  provinces: string[]
  districts_by_province: Record<string, string[]>
  ugels: string[]
  ugels_by_province: Record<string, string[]>
  levels: string[]
  managements: string[]
  areas: string[]
  comparison_groups: { value: string; label: string }[]
}

export type DashboardRequest = {
  start_year: number
  end_year: number
  comparison_group: string
  alert_group: string
  filters: Filters
}

export type DashboardData = any

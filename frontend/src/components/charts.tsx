import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { useTheme } from '@/hooks/useTheme';
import { formatCurrency } from '@/lib/utils';

/** Chart colours read from the same CSS variables as the rest of the theme. */
export const CHART_COLORS = [
  'hsl(var(--chart-1))',
  'hsl(var(--chart-2))',
  'hsl(var(--chart-3))',
  'hsl(var(--chart-4))',
  'hsl(var(--chart-5))',
];

const useAxisProps = () => {
  const { resolved } = useTheme();
  const muted = resolved === 'dark' ? 'hsl(240 5% 62%)' : 'hsl(240 4% 46%)';
  const grid = resolved === 'dark' ? 'hsl(240 6% 20%)' : 'hsl(240 6% 90%)';
  return { muted, grid };
};

const tooltipStyle = {
  backgroundColor: 'hsl(var(--popover))',
  border: '1px solid hsl(var(--border))',
  borderRadius: '0.5rem',
  color: 'hsl(var(--popover-foreground))',
  fontSize: '12px',
};

export const TrendChart = ({
  data,
  height = 240,
}: {
  data: { date: string; orders: number; value: number }[];
  height?: number;
}) => {
  const { muted, grid } = useAxisProps();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 4, right: 8, left: -18, bottom: 0 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.35} />
            <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fill: muted, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          tickFormatter={(value: string) => value.slice(5)}
          minTickGap={24}
        />
        <YAxis tick={{ fill: muted, fontSize: 11 }} tickLine={false} axisLine={false} width={44} />
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, name) =>
            name === 'value'
              ? [formatCurrency(Number(value)), 'Value']
              : [String(value), 'Orders']
          }
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke="hsl(var(--chart-1))"
          strokeWidth={2}
          fill="url(#trendFill)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

export const CategoryBarChart = ({
  data,
  height = 240,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) => {
  const { muted, grid } = useAxisProps();
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={grid} horizontal={false} />
        <XAxis type="number" tick={{ fill: muted, fontSize: 11 }} tickLine={false} axisLine={false} />
        <YAxis
          type="category"
          dataKey="label"
          tick={{ fill: muted, fontSize: 11 }}
          tickLine={false}
          axisLine={false}
          width={96}
        />
        <Tooltip contentStyle={tooltipStyle} formatter={(value) => formatCurrency(Number(value))} />
        <Bar dataKey="value" radius={[0, 6, 6, 0]}>
          {data.map((_, index) => (
            <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};

export const DonutChart = ({
  data,
  height = 240,
}: {
  data: { label: string; value: number }[];
  height?: number;
}) => (
  <ResponsiveContainer width="100%" height={height}>
    <PieChart>
      <Pie data={data} dataKey="value" nameKey="label" innerRadius="58%" outerRadius="85%" paddingAngle={2}>
        {data.map((_, index) => (
          <Cell key={index} fill={CHART_COLORS[index % CHART_COLORS.length]} stroke="none" />
        ))}
      </Pie>
      <Tooltip contentStyle={tooltipStyle} />
    </PieChart>
  </ResponsiveContainer>
);

import { View, Text, StyleSheet, ViewProps } from 'react-native';
import { ReactNode } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react-native';
import Card from './Card';

type StatCardProps = ViewProps & {
  title: string;
  value: string;
  icon: ReactNode;
  trend?: number;
};

export default function StatCard({ title, value, icon, trend = 0, style, ...props }: StatCardProps) {
  const { colors } = useTheme();
  
  const styles = createStyles(colors);

  return (
    <Card style={[styles.card, style]} {...props}>
      <View style={styles.header}>
        <Text style={styles.title}>{title}</Text>
        <View style={styles.iconContainer}>
          {icon}
        </View>
      </View>
      <Text style={styles.value}>{value}</Text>
      
      {/* Always show trend container */}
      <View style={styles.trendContainer}>
        {trend > 0 ? (
          <TrendingUp size={16} color="#22C55E" />
        ) : trend < 0 ? (
          <TrendingDown size={16} color="#EF4444" />
        ) : (
          <Minus size={16} color="#94A3B8" />
        )}
        <Text style={[
          styles.trendText,
          { 
            color: trend > 0 ? '#22C55E' : trend < 0 ? '#EF4444' : '#94A3B8'
          }
        ]}>
          {trend > 0 ? '+' : ''}{trend}%
        </Text>
        <Text style={styles.periodText}>vs last month</Text>
      </View>
    </Card>
  );
}

const createStyles = (colors: any) => StyleSheet.create({
  card: {
    padding: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  title: {
    fontSize: 14,
    color: colors.textSecondary,
    fontFamily: 'Inter-Regular',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.backgroundTertiary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  value: {
    fontSize: 24,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 8,
    fontFamily: 'Inter-Bold',
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trendText: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter-SemiBold',
  },
  periodText: {
    fontSize: 12,
    color: colors.textTertiary,
    fontFamily: 'Inter-Regular',
  },
});
import { auth } from '../firebase';
import { Booking, FinancialScenario } from '../types/alba';

export async function calculateServerCommission(params: {
  lockedUnitPrice: number;
  standardWeekendUnitPrice: number;
  participants: number;
  commissionRatePercent: number;
  variableCostPerTxn?: number;
}) {
  const user = auth.currentUser;
  if (!user) {
    throw new Error('Authentication required for server-side financial calculation.');
  }
  const token = await user.getIdToken();
  const res = await fetch('/api/financial/calculate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(params),
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Financial calculation failed.');
  }
  return data as {
    grossAmount: number;
    customerSavings: number;
    commissionRatePercent: number;
    platformCommission: number;
    merchantPayable: number;
    contributionMargin: number;
  };
}

export function computeScenarioProjection(scenario: FinancialScenario) {
  const monthlyTransactions = Math.round(
    scenario.expectedCustomers * scenario.purchasesPerCustomer
  );
  const contributionPerSale =
    scenario.revenuePerTransaction - scenario.variableCostPerTxn;
  const monthlyRevenue = monthlyTransactions * scenario.revenuePerTransaction;
  const totalVariableCost = monthlyTransactions * scenario.variableCostPerTxn;
  const totalContribution = monthlyTransactions * contributionPerSale;
  const netOperatingSurplus = totalContribution - scenario.monthlyFixedCost;
  const breakEvenTransactions =
    contributionPerSale > 0
      ? Math.ceil(scenario.monthlyFixedCost / contributionPerSale)
      : 0;

  return {
    monthlyTransactions,
    contributionPerSale,
    monthlyRevenue,
    totalVariableCost,
    totalContribution,
    netOperatingSurplus,
    breakEvenTransactions,
  };
}

export function exportBookingsFinancialCsv(bookings: Booking[], filename = 'alba_financial_report.csv') {
  const headers = [
    'Booking ID',
    'Venue Name',
    'Activity Date',
    'Time Slot',
    'Participants',
    'Status',
    'Payment Status',
    'Price Lock Applied',
    'Gross Booking Value (INR)',
    'Customer Savings (INR)',
    'Commission Rate (%)',
    'Platform Commission (INR)',
    'Merchant Payable (INR)',
  ];

  const rows = bookings.map((b) => [
    b.id,
    `"${(b.venueName || '').replace(/"/g, '""')}"`,
    b.activityDate,
    `"${b.timeSlot}"`,
    b.participants,
    b.status,
    b.paymentStatus,
    b.priceLockApplied ? 'Yes' : 'No',
    b.grossAmount || 0,
    b.customerSavings || 0,
    b.commissionRatePercent ?? 15,
    b.platformCommission || 0,
    b.merchantPayable || 0,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

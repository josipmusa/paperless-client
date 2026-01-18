import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Search, ChevronRight, FileText, Filter } from 'lucide-react-native';
import Toast from 'react-native-root-toast';
import { CompositeNavigationProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { InvoiceData, getPaginatedInvoices } from '../api/invoiceApi';
import { RootStackParamList, MainTabParamList } from '../navigation/types';

type InvoicesScreenNavigationProp = CompositeNavigationProp<
  BottomTabNavigationProp<MainTabParamList, 'Invoices'>,
  NativeStackNavigationProp<RootStackParamList>
>;

interface Props {
  navigation: InvoicesScreenNavigationProp;
}

type DateFilter = 'all' | '7days' | '30days';

export default function InvoicesScreen({ navigation }: Props) {
  const [invoices, setInvoices] = useState<InvoiceData[]>([]);
  const [filteredInvoices, setFilteredInvoices] = useState<InvoiceData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [showFilters, setShowFilters] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);
  const [hasMorePages, setHasMorePages] = useState(true);

  useEffect(() => {
    loadInvoices();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [searchQuery, dateFilter, invoices]);

  const loadInvoices = async (isRefresh = false, page = 0) => {
    if (isRefresh) {
      setIsRefreshing(true);
    } else if (page > 0) {
      setIsLoadingMore(true);
    } else {
      setIsLoading(true);
    }

    try {
      const response = await getPaginatedInvoices(page, 50);
      
      if (isRefresh || page === 0) {
        setInvoices(response.content);
        setCurrentPage(0);
      } else {
        setInvoices(prev => [...prev, ...response.content]);
        setCurrentPage(page);
      }
      
      setHasMorePages(response.page.number + 1 < response.page.totalPages);
    } catch (error) {
      console.error('Failed to load invoices:', error);
      Toast.show('Failed to load invoices', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        backgroundColor: '#ef4444',
      });
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
      setIsLoadingMore(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...invoices];

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (invoice) =>
          invoice.invoiceNumber.toLowerCase().includes(query) ||
          invoice.customerName.toLowerCase().includes(query)
      );
    }

    // Apply date filter
    if (dateFilter !== 'all' && filtered.length > 0) {
      const now = new Date();
      const daysAgo = dateFilter === '7days' ? 7 : 30;
      const cutoffDate = new Date(now.getTime() - daysAgo * 24 * 60 * 60 * 1000);
      
      filtered = filtered.filter(invoice => {
        if (!invoice.createdAt) return true;
        return new Date(invoice.createdAt) >= cutoffDate;
      });
    }

    setFilteredInvoices(filtered);
  };

  const handleRefresh = useCallback(() => {
    loadInvoices(true, 0);
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!isLoadingMore && hasMorePages && !searchQuery && dateFilter === 'all') {
      loadInvoices(false, currentPage + 1);
    }
  }, [isLoadingMore, hasMorePages, currentPage, searchQuery, dateFilter]);

  const handleInvoicePress = (invoice: InvoiceData) => {
    navigation.navigate('InvoiceDetail', { invoice });
  };

  const renderInvoiceItem = ({ item }: { item: InvoiceData }) => (
    <TouchableOpacity
      style={styles.invoiceItem}
      onPress={() => handleInvoicePress(item)}
      activeOpacity={0.7}
    >
      <View style={styles.invoiceContent}>
        <View style={styles.invoiceLeft}>
          <View style={styles.invoiceIconContainer}>
            <FileText size={20} color="#3b82f6" />
          </View>
          <View style={styles.invoiceInfo}>
            <Text style={styles.invoiceNumber}>{item.invoiceNumber}</Text>
            <Text style={styles.customerName}>{item.customerName}</Text>
          </View>
        </View>
        <View style={styles.invoiceRight}>
          <Text style={styles.amount}>
            {item.currency} {item.totalAmount.toFixed(2)}
          </Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusText}>Generated</Text>
          </View>
        </View>
      </View>
      <ChevronRight size={20} color="#64748b" style={styles.chevron} />
    </TouchableOpacity>
  );

  const renderEmptyState = () => (
    <View style={styles.emptyContainer}>
      <View style={styles.emptyIconCircle}>
        <FileText size={40} color="#475569" />
      </View>
      <Text style={styles.emptyText}>No invoices yet</Text>
      <Text style={styles.emptySubtext}>
        Record your first invoice to see it here
      </Text>
    </View>
  );

  const renderFilterChip = (label: string, value: DateFilter, icon?: React.ReactNode) => (
    <TouchableOpacity
      style={[
        styles.filterChip,
        dateFilter === value && styles.filterChipActive,
      ]}
      onPress={() => setDateFilter(value)}
    >
      {icon}
      <Text
        style={[
          styles.filterChipText,
          dateFilter === value && styles.filterChipTextActive,
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Invoices</Text>
        </View>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Invoices</Text>
      </View>

      {/* Search Bar */}
      <View style={styles.searchContainer}>
        <View style={styles.searchInputContainer}>
          <Search size={20} color="#64748b" />
          <TextInput
            style={styles.searchInput}
            placeholder="Search by invoice # or customer"
            placeholderTextColor="#64748b"
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
        <TouchableOpacity
          style={[styles.filterButton, showFilters && styles.filterButtonActive]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Filter size={20} color={showFilters ? '#3b82f6' : '#cbd5e1'} />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      {showFilters && (
        <View style={styles.filtersContainer}>
          <View style={styles.filterSection}>
            <Text style={styles.filterLabel}>Date Range</Text>
            <View style={styles.filterChips}>
              {renderFilterChip('All', 'all')}
              {renderFilterChip('Last 7 days', '7days')}
              {renderFilterChip('Last 30 days', '30days')}
            </View>
          </View>
        </View>
      )}

      {/* Invoice List */}
      <FlatList
        data={filteredInvoices}
        renderItem={renderInvoiceItem}
        keyExtractor={(item) => item.invoiceNumber}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={renderEmptyState}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={handleRefresh}
            tintColor="#3b82f6"
            colors={['#3b82f6']}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={
          isLoadingMore ? (
            <View style={styles.loadingMore}>
              <ActivityIndicator size="small" color="#3b82f6" />
            </View>
          ) : null
        }
      />

      {/* Results count */}
      {filteredInvoices.length > 0 && (
        <View style={styles.resultsBar}>
          <Text style={styles.resultsText}>
            {filteredInvoices.length} {filteredInvoices.length === 1 ? 'invoice' : 'invoices'}
            {hasMorePages && !searchQuery && dateFilter === 'all' && ' • Scroll for more'}
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0f172a',
  },
  header: {
    padding: 16,
    backgroundColor: '#1e293b',
    borderBottomWidth: 1,
    borderColor: '#334155',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#f1f5f9',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 12,
  },
  searchInputContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#f1f5f9',
  },
  filterButton: {
    width: 48,
    height: 48,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterButtonActive: {
    backgroundColor: '#1e3a5f',
    borderColor: '#3b82f6',
  },
  filtersContainer: {
    backgroundColor: '#1e293b',
    marginHorizontal: 16,
    marginBottom: 16,
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#334155',
  },
  filterSection: {
    marginBottom: 0,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 12,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#0f172a',
    borderWidth: 1,
    borderColor: '#334155',
    gap: 6,
  },
  filterChipActive: {
    backgroundColor: '#1e3a5f',
    borderColor: '#3b82f6',
  },
  filterChipText: {
    fontSize: 14,
    color: '#cbd5e1',
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#3b82f6',
    fontWeight: '600',
  },
  listContent: {
    padding: 16,
    paddingBottom: 80,
  },
  invoiceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#334155',
  },
  invoiceContent: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  invoiceLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  invoiceIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 10,
    backgroundColor: '#1e3a5f',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  invoiceInfo: {
    flex: 1,
  },
  invoiceNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: '#f1f5f9',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
    color: '#94a3b8',
  },
  invoiceRight: {
    alignItems: 'flex-end',
  },
  amount: {
    fontSize: 16,
    fontWeight: '700',
    color: '#10b981',
    marginBottom: 6,
  },
  statusBadge: {
    backgroundColor: '#064e3b',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#10b981',
  },
  chevron: {
    marginLeft: 8,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
  },
  emptyIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#1e293b',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyText: {
    color: '#f1f5f9',
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 8,
  },
  emptySubtext: {
    color: '#94a3b8',
    fontSize: 14,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  loadingMore: {
    paddingVertical: 20,
    alignItems: 'center',
  },
  resultsBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1e293b',
    borderTopWidth: 1,
    borderColor: '#334155',
    padding: 12,
    alignItems: 'center',
  },
  resultsText: {
    fontSize: 13,
    color: '#94a3b8',
    fontWeight: '500',
  },
});

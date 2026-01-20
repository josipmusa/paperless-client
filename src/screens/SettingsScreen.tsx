import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Modal,
  Platform,
  Alert,
} from 'react-native';
import { useForm, Controller } from 'react-hook-form';
import { SafeAreaView } from 'react-native-safe-area-context';
import { FileText } from 'lucide-react-native';
import Toast from 'react-native-root-toast';
import { useAuthStore } from '../store/authStore';
import { CompanyData, getMyCompany, updateCompany, deleteUserAccount } from '../api/companyApi';
import { PdfViewer } from "../components/PdfViewer";
import {getSampleInvoicePdfPreview} from "../api/invoiceApi";

export default function SettingsScreen() {
  const [isLoading, setIsLoading] = useState(false);
  const [isFetchingData, setIsFetchingData] = useState(true);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [hasChanges, setHasChanges] = useState(false);
  const [viewerVisible, setViewerVisible] = useState(false);
  const [previewBase64, setPreviewBase64] = useState('');
  const signOut = useAuthStore((state) => state.signOut);

  const { control, handleSubmit, formState: { errors }, reset, watch } = useForm<CompanyData>({
    defaultValues: {
      businessName: '',
      address: '',
      phone: '',
      email: '',
      currency: '',
      paymentNotes: '',
    },
  });

  const formValues = watch();

  useEffect(() => {
    loadCompanyData();
  }, []);

  useEffect(() => {
    const subscription = watch(() => setHasChanges(true));
    return () => subscription.unsubscribe();
  }, [watch]);

  const loadCompanyData = async () => {
    try {
      const company = await getMyCompany();
      if (company) {
        reset(company);
        setHasChanges(false);
      }
    } catch (error) {
      console.error('Failed to load company data:', error);
      Toast.show('Failed to load company data', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        backgroundColor: '#ef4444',
      });
    } finally {
      setIsFetchingData(false);
    }
  };

  const onSubmit = async (data: CompanyData) => {
    setIsLoading(true);
    try {
      await updateCompany(data);
      setHasChanges(false);
      Toast.show('Company profile updated successfully', {
        duration: Toast.durations.SHORT,
        position: Toast.positions.BOTTOM,
        backgroundColor: '#10b981',
      });
    } catch (error: any) {
      Toast.show(error.response?.data?.message || 'Failed to update company profile', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        backgroundColor: '#ef4444',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreviewInvoice = async () => {
    try {
      setIsLoading(true);

      const base64 = await getSampleInvoicePdfPreview();
      setPreviewBase64(base64);
      setViewerVisible(true);
    } catch (error: any) {
      Toast.show('Failed to load invoice preview', {
        duration: Toast.durations.LONG,
        backgroundColor: '#ef4444',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogout = () => {
    if (Platform.OS === 'web') {
      if (confirm('Are you sure you want to logout?')) {
        signOut();
      }
    } else {
      Alert.alert(
        'Logout',
        'Are you sure you want to logout?',
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Logout', style: 'destructive', onPress: signOut },
        ]
      );
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await deleteUserAccount();
      setShowDeleteModal(false);
      Toast.show('Account deleted successfully', {
        duration: Toast.durations.SHORT,
        position: Toast.positions.BOTTOM,
        backgroundColor: '#10b981',
      });
      await signOut();
    } catch (error: any) {
      Toast.show(error.response?.data?.message || 'Failed to delete account', {
        duration: Toast.durations.LONG,
        position: Toast.positions.BOTTOM,
        backgroundColor: '#ef4444',
      });
    } finally {
      setIsDeleting(false);
    }
  };

  if (isFetchingData) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Settings</Text>
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
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Section 1: Company Profile */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Company Profile</Text>
          <Text style={styles.sectionSubtitle}>
            Information displayed on generated invoices
          </Text>

          <Controller
            control={control}
            name="businessName"
            rules={{ required: 'Business name is required' }}
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Business Name *</Text>
                <TextInput
                  style={[styles.input, errors.businessName && styles.inputError]}
                  placeholder="Enter business name"
                  placeholderTextColor="#64748b"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
                {errors.businessName && (
                  <Text style={styles.errorText}>{errors.businessName.message}</Text>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="email"
            rules={{
              required: 'Email is required',
              pattern: { value: /^\S+@\S+$/i, message: 'Invalid email' },
            }}
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Email *</Text>
                <TextInput
                  style={[styles.input, errors.email && styles.inputError]}
                  placeholder="Enter email"
                  placeholderTextColor="#64748b"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  keyboardType="email-address"
                  autoCapitalize="none"
                />
                {errors.email && (
                  <Text style={styles.errorText}>{errors.email.message}</Text>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="phone"
            rules={{ required: 'Phone number is required' }}
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Phone Number *</Text>
                <TextInput
                  style={[styles.input, errors.phone && styles.inputError]}
                  placeholder="Enter phone number"
                  placeholderTextColor="#64748b"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  keyboardType="phone-pad"
                />
                {errors.phone && (
                  <Text style={styles.errorText}>{errors.phone.message}</Text>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="address"
            rules={{ required: 'Address is required' }}
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Address *</Text>
                <TextInput
                  style={[styles.input, styles.textArea, errors.address && styles.inputError]}
                  placeholder="Enter business address"
                  placeholderTextColor="#64748b"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  multiline
                  numberOfLines={3}
                />
                {errors.address && (
                  <Text style={styles.errorText}>{errors.address.message}</Text>
                )}
              </View>
            )}
          />

          <Controller
            control={control}
            name="currency"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Currency</Text>
                <TextInput
                  style={styles.input}
                  placeholder="e.g., USD, EUR, GBP"
                  placeholderTextColor="#64748b"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                />
              </View>
            )}
          />

          <Controller
            control={control}
            name="paymentNotes"
            render={({ field: { onChange, onBlur, value } }) => (
              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Payment Notes</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Additional payment instructions"
                  placeholderTextColor="#64748b"
                  onBlur={onBlur}
                  onChangeText={onChange}
                  value={value}
                  multiline
                  numberOfLines={3}
                />
              </View>
            )}
          />

          <TouchableOpacity
            style={[styles.primaryButton, (!hasChanges || isLoading) && styles.buttonDisabled]}
            onPress={handleSubmit(onSubmit)}
            disabled={!hasChanges || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.buttonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Section 2: Invoice Preview */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Invoice Preview</Text>
          <Text style={styles.sectionSubtitle}>
            Preview how your company details appear on invoices
            Note: This is a sample invoice and does not affect any real data.
          </Text>

          <TouchableOpacity style={styles.previewButton} onPress={handlePreviewInvoice}>
            <FileText size={20} color="#3b82f6" />
            <Text style={styles.previewButtonText}>Preview Sample Invoice</Text>
          </TouchableOpacity>
        </View>

        {/* Section 3: Account Actions */}
        <View style={styles.accountSection}>
          <Text style={styles.sectionTitle}>Account</Text>

          <TouchableOpacity style={styles.logoutButton} onPress={handleLogout}>
            <Text style={styles.logoutButtonText}>Logout</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.dangerButton}
            onPress={() => setShowDeleteModal(true)}
          >
            <Text style={styles.dangerButtonText}>Delete Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Delete Confirmation Modal */}
      <Modal
        visible={showDeleteModal}
        transparent
        animationType="fade"
        onRequestClose={() => setShowDeleteModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Account</Text>
            <Text style={styles.modalText}>
              Are you sure you want to delete your account? This action cannot be undone and all
              your data will be permanently deleted.
            </Text>

            <View style={styles.modalButtons}>
              <TouchableOpacity
                style={[styles.modalButton, styles.modalCancelButton]}
                onPress={() => setShowDeleteModal(false)}
                disabled={isDeleting}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.modalButton, styles.modalDeleteButton]}
                onPress={handleDeleteAccount}
                disabled={isDeleting}
              >
                {isDeleting ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={styles.modalDeleteText}>Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
      <PdfViewer
          visible={viewerVisible}
          pdfBase64={previewBase64}
          invoiceNumber="INV-SAMPLE-0000"
          onClose={() => setViewerVisible(false)}
      />
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
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  section: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 8,
    marginTop: 4,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: '#94a3b8',
    marginBottom: 24,
    lineHeight: 20,
  },
  inputContainer: {
    marginBottom: 16,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#cbd5e1',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#0f172a',
    borderRadius: 8,
    padding: 14,
    borderWidth: 1,
    borderColor: '#334155',
    fontSize: 16,
    color: '#f1f5f9',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  inputError: {
    borderColor: '#ef4444',
  },
  errorText: {
    color: '#ef4444',
    fontSize: 12,
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: '#3b82f6',
    borderRadius: 8,
    padding: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#1e3a5f',
    borderRadius: 10,
    padding: 16,
    gap: 10,
    borderWidth: 1,
    borderColor: '#3b82f6',
  },
  previewButtonText: {
    color: '#3b82f6',
    fontSize: 16,
    fontWeight: '600',
  },
  accountSection: {
    gap: 12,
    marginBottom: 16,
  },
  logoutButton: {
    backgroundColor: '#334155',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButton: {
    backgroundColor: '#7f1d1d',
    borderRadius: 10,
    padding: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ef4444',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  dangerButtonText: {
    color: '#fca5a5',
    fontSize: 16,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1e293b',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#f1f5f9',
    marginBottom: 12,
  },
  modalText: {
    fontSize: 16,
    color: '#cbd5e1',
    lineHeight: 24,
    marginBottom: 24,
  },
  modalButtons: {
    flexDirection: 'row',
    gap: 12,
  },
  modalButton: {
    flex: 1,
    padding: 14,
    borderRadius: 8,
    alignItems: 'center',
  },
  modalCancelButton: {
    backgroundColor: '#334155',
  },
  modalDeleteButton: {
    backgroundColor: '#ef4444',
  },
  modalCancelText: {
    color: '#f1f5f9',
    fontSize: 16,
    fontWeight: '600',
  },
  modalDeleteText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

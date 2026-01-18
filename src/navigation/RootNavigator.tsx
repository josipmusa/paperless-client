import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { RootStackParamList } from './types';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import CompanySetupScreen from '../screens/CompanySetupScreen';
import HomeScreen from '../screens/HomeScreen';
import InvoiceDetailScreen from '../screens/InvoiceDetailScreen';
import MainTabNavigator from './MainTabNavigator';
import { useAuthStore } from '../store/authStore';

const Stack = createNativeStackNavigator<RootStackParamList>();

export default function RootNavigator() {
  const session = useAuthStore((state) => state.session);
  const isCompanySetupComplete = useAuthStore((state) => state.isCompanySetupComplete);

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!session ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
          <Stack.Screen name="CompanySetup" component={CompanySetupScreen} />
        </>
      ) : !isCompanySetupComplete ? (
        <Stack.Screen name="CompanySetup" component={CompanySetupScreen} />
      ) : (
        <>
          <Stack.Screen name="MainTabs" component={MainTabNavigator} />
          <Stack.Screen name="InvoiceDetail" component={InvoiceDetailScreen} />
          <Stack.Screen name="Home" component={HomeScreen} />
        </>
      )}
    </Stack.Navigator>
  );
}

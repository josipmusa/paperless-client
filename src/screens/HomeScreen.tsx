import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuthStore } from '../store/authStore';

export default function HomeScreen() {
  const signOut = useAuthStore((state) => state.signOut);
  const user = useAuthStore((state) => state.user);

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Welcome!</Text>
      <Text style={styles.subtitle}>{user?.email}</Text>
      <TouchableOpacity style={styles.button} onPress={signOut}>
        <Text style={styles.buttonText}>Sign Out</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 32,
  },
  button: {
    backgroundColor: '#e74c3c',
    borderRadius: 8,
    padding: 16,
    paddingHorizontal: 32,
  },
  buttonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

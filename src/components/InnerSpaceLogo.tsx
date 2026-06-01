import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

export default function InnerSpaceLogo({ size = 36 }: { size?: number }) {
  const ring = Math.max(size, 28);
  return (
    <View style={[styles.wrap, { width: ring, height: ring, borderRadius: ring / 2 }]}>
      <View style={[styles.core, { borderRadius: (ring - 10) / 2 }]}>
        <Text style={styles.emoji}>🧠</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: '#102449',
    borderWidth: 1,
    borderColor: '#4A9EFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  core: {
    width: '80%',
    height: '80%',
    backgroundColor: '#0A0F1E',
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 16,
  },
});

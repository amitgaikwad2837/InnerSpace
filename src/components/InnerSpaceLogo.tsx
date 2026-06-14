import React from 'react';
import { Image, View } from 'react-native';

const logoAsset = require('../../assets/icon.png');

export default function InnerSpaceLogo({ size = 36 }: { size?: number }) {
  const s = Math.max(size, 20);
  return (
    <Image
      source={logoAsset}
      style={{ width: s, height: s, borderRadius: Math.round(s * 0.2) }}
      resizeMode="contain"
    />
  );
}

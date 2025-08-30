import React, { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Dimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

interface MountainAnimationProps {
  progress: number; // 0 to 100
}

export default function MountainAnimation({ progress }: MountainAnimationProps) {
  const climberPosition = useRef(new Animated.Value(0)).current;
  const flagOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Animate climber position based on progress
    Animated.timing(climberPosition, {
      toValue: progress,
      duration: 1000,
      useNativeDriver: false,
    }).start();

    // Show flag when progress is complete
    if (progress >= 100) {
      Animated.timing(flagOpacity, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }).start();
    } else {
      flagOpacity.setValue(0);
    }
  }, [progress]);

  const climberBottom = climberPosition.interpolate({
    inputRange: [0, 100],
    outputRange: [50, screenHeight * 0.7],
    extrapolate: 'clamp',
  });

  const climberLeft = climberPosition.interpolate({
    inputRange: [0, 25, 50, 75, 100],
    outputRange: [
      screenWidth * 0.1,
      screenWidth * 0.3,
      screenWidth * 0.5,
      screenWidth * 0.7,
      screenWidth * 0.5,
    ],
    extrapolate: 'clamp',
  });

  return (
    <View style={styles.container}>
      {/* Sky gradient background */}
      <LinearGradient
        colors={['#87CEEB', '#E0F6FF', '#87CEEB']}
        style={styles.background}
      />

      {/* Mountain peaks */}
      <View style={styles.mountainContainer}>
        {/* Back mountain */}
        <View style={[styles.mountain, styles.backMountain]} />
        
        {/* Main mountain */}
        <View style={[styles.mountain, styles.mainMountain]} />
        
        {/* Front mountain */}
        <View style={[styles.mountain, styles.frontMountain]} />
      </View>

      {/* Mountain stations (合目) */}
      <View style={styles.stationsContainer}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((station, index) => {
          const stationProgress = station * 10;
          const isReached = progress >= stationProgress;
          const isCurrent = progress >= (station - 1) * 10 && progress < stationProgress;
          
          return (
            <View
              key={station}
              style={[
                styles.station,
                {
                  bottom: 50 + (index * (screenHeight * 0.055)),
                  left: screenWidth * (0.15 + (index % 2 === 0 ? 0 : 0.4) + (index * 0.03)),
                }
              ]}
            >
              <View style={[
                styles.stationMarker,
                isReached ? styles.stationReached : styles.stationUnreached,
                isCurrent ? styles.stationCurrent : null,
              ]} />
            </View>
          );
        })}
      </View>
      
      {/* Current position indicator */}
      <View style={[
        styles.currentPositionContainer,
        {
          bottom: 50 + ((progress / 10) * (screenHeight * 0.055)),
          left: screenWidth * (0.05 + ((progress / 100) * 0.5)),
        }
      ]}>
        <View style={styles.currentPositionArrow} />
        <Text style={styles.currentPositionText}>
          現在位置: {Math.floor(progress / 10) + 1}合目への道のり
        </Text>
      </View>

      {/* Climber */}
      <Animated.View
        style={[
          styles.climber,
          {
            bottom: climberBottom,
            left: climberLeft,
          }
        ]}
      >
        <View style={styles.climberBody} />
        <View style={styles.climberHead} />
      </Animated.View>

      {/* Flag at the top */}
      <Animated.View
        style={[
          styles.flag,
          {
            opacity: flagOpacity,
          }
        ]}
      >
        <View style={styles.flagPole} />
        <View style={styles.flagCloth} />
      </Animated.View>

      {/* Enhanced progress indicator */}
      <View style={styles.progressContainer}>
        <Text style={styles.progressLabel}>登山進捗: {Math.round(progress)}%</Text>
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%` }]} />
        </View>
        <Text style={styles.progressStationLabel}>
          {progress >= 100 ? '頂上到達！' : `次の目標: ${Math.floor(progress / 10) + 1}合目`}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    overflow: 'hidden',
  },
  background: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
  },
  mountainContainer: {
    flex: 1,
    position: 'relative',
  },
  mountain: {
    position: 'absolute',
    bottom: 0,
  },
  backMountain: {
    width: screenWidth * 0.6,
    height: screenHeight * 0.4,
    backgroundColor: '#8B7D6B',
    right: 0,
    transform: [{ skewX: '-15deg' }],
  },
  mainMountain: {
    width: screenWidth * 0.8,
    height: screenHeight * 0.6,
    backgroundColor: '#8B4513',
    left: screenWidth * 0.1,
    transform: [{ skewX: '10deg' }],
  },
  frontMountain: {
    width: screenWidth * 0.4,
    height: screenHeight * 0.3,
    backgroundColor: '#654321',
    left: 0,
    transform: [{ skewX: '20deg' }],
  },
  stationsContainer: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  station: {
    position: 'absolute',
    alignItems: 'center',
    minWidth: 60,
  },
  stationMarker: {
    width: 16,
    height: 16,
    borderRadius: 8,
    marginBottom: 4,
    borderWidth: 2,
  },
  stationReached: {
    backgroundColor: '#4CAF50',
    borderColor: '#2E7D32',
  },
  stationUnreached: {
    backgroundColor: '#E0E0E0',
    borderColor: '#BDBDBD',
  },
  stationCurrent: {
    backgroundColor: '#FF9800',
    borderColor: '#F57C00',
    transform: [{ scale: 1.3 }],
  },
  stationText: {
    fontSize: 10,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  stationTextReached: {
    color: '#2E7D32',
  },
  stationTextUnreached: {
    color: '#9E9E9E',
  },
  stationTextCurrent: {
    color: '#F57C00',
    fontSize: 12,
  },
  currentPositionContainer: {
    position: 'absolute',
    alignItems: 'center',
    maxWidth: screenWidth * 0.4,
  },
  currentPositionArrow: {
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 8,
    borderLeftColor: 'transparent',
    borderRightColor: 'transparent',
    borderTopColor: '#FF5722',
    marginBottom: 4,
  },
  currentPositionText: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#FF5722',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
    textAlign: 'center',
  },
  climber: {
    position: 'absolute',
    width: 20,
    height: 30,
    alignItems: 'center',
  },
  climberBody: {
    width: 12,
    height: 20,
    backgroundColor: '#FF4444',
    borderRadius: 6,
  },
  climberHead: {
    width: 10,
    height: 10,
    backgroundColor: '#FFDBAC',
    borderRadius: 5,
    position: 'absolute',
    top: -5,
  },
  flag: {
    position: 'absolute',
    top: screenHeight * 0.2,
    right: screenWidth * 0.4,
    alignItems: 'center',
  },
  flagPole: {
    width: 2,
    height: 40,
    backgroundColor: '#8B4513',
  },
  flagCloth: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 20,
    height: 15,
    backgroundColor: '#FFD700',
  },
  progressContainer: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  progressLabel: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
    textAlign: 'center',
    marginBottom: 8,
  },
  progressBar: {
    height: 12,
    backgroundColor: '#E0E0E0',
    borderRadius: 6,
    overflow: 'hidden',
    marginBottom: 8,
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#4CAF50',
  },
  progressStationLabel: {
    fontSize: 14,
    color: '#666',
    textAlign: 'center',
  },
});
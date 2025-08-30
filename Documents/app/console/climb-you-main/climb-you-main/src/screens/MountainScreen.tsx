import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import MountainAnimation from '../components/MountainAnimation';

export default function MountainScreen() {
  const [progress, setProgress] = useState(45);
  const [level, setLevel] = useState(3);
  const [totalTasks, setTotalTasks] = useState(120);
  const [completedTasks, setCompletedTasks] = useState(54);

  useEffect(() => {
    const calculatedProgress = (completedTasks / totalTasks) * 100;
    setProgress(Math.min(calculatedProgress, 100));
  }, [completedTasks, totalTasks]);

  const handleProgressIncrease = () => {
    if (completedTasks < totalTasks) {
      setCompletedTasks(prev => prev + 1);
    }
  };

  const handleProgressDecrease = () => {
    if (completedTasks > 0) {
      setCompletedTasks(prev => prev - 1);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Mountain Climb</Text>
        <Text style={styles.level}>Level {level}</Text>
      </View>

      <View style={styles.mountainContainer}>
        <MountainAnimation progress={progress} />
      </View>

      <View style={styles.statsContainer}>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{Math.round(progress)}%</Text>
          <Text style={styles.statLabel}>Progress</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{completedTasks}</Text>
          <Text style={styles.statLabel}>Tasks Done</Text>
        </View>
        <View style={styles.statItem}>
          <Text style={styles.statNumber}>{totalTasks - completedTasks}</Text>
          <Text style={styles.statLabel}>Remaining</Text>
        </View>
      </View>

      <View style={styles.messageContainer}>
        {progress >= 100 ? (
          <Text style={styles.successMessage}>
            🎉 Congratulations! You've reached the summit!
          </Text>
        ) : progress >= 75 ? (
          <Text style={styles.progressMessage}>
            🔥 Almost there! Keep climbing!
          </Text>
        ) : progress >= 50 ? (
          <Text style={styles.progressMessage}>
            💪 Great progress! You're halfway up!
          </Text>
        ) : progress >= 25 ? (
          <Text style={styles.progressMessage}>
            🌱 Good start! Keep going!
          </Text>
        ) : (
          <Text style={styles.progressMessage}>
            🏔️ Your journey begins here!
          </Text>
        )}
      </View>

      <View style={styles.controlsContainer}>
        <TouchableOpacity
          style={[styles.controlButton, styles.decreaseButton]}
          onPress={handleProgressDecrease}
        >
          <Text style={styles.controlButtonText}>- Task</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.controlButton, styles.increaseButton]}
          onPress={handleProgressIncrease}
        >
          <Text style={styles.controlButtonText}>+ Task</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgb(26,72,108)',
  },
  header: {
    paddingTop: 60,
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: 'rgb(64,99,131)',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 4,
  },
  level: {
    fontSize: 16,
    color: '#E0E0E0',
  },
  mountainContainer: {
    flex: 1,
    marginVertical: 20,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    backgroundColor: 'white',
    paddingVertical: 20,
    marginHorizontal: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statItem: {
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#007AFF',
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 14,
    color: '#666',
  },
  messageContainer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    alignItems: 'center',
  },
  successMessage: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#4CAF50',
    textAlign: 'center',
  },
  progressMessage: {
    fontSize: 16,
    color: '#E0E0E0',
    textAlign: 'center',
  },
  controlsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 16,
  },
  controlButton: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  increaseButton: {
    backgroundColor: '#4CAF50',
  },
  decreaseButton: {
    backgroundColor: '#FF6B6B',
  },
  controlButtonText: {
    color: 'white',
    fontWeight: 'bold',
    fontSize: 16,
  },
});
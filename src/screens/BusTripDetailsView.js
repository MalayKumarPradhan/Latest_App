import React from 'react';
import {
  Pressable,
  StyleSheet,
  View,
} from 'react-native';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { ActivityIndicator, Button, Card, Text } from 'react-native-paper';

function SectionHeading({ title, subtitle }) {
  return (
    <View style={styles.sectionHeading}>
      <Text variant="titleLarge" style={styles.sectionTitle}>{title}</Text>
      {subtitle ? <Text variant="bodySmall" style={styles.subtitle}>{subtitle}</Text> : null}
    </View>
  );
}

function StopChoice({ item, selected, onPress, kind }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      style={[styles.stopChoice, selected && styles.stopChoiceSelected]}
    >
      <View style={styles.stopChoiceHeader}>
        <View style={[styles.pointIcon, selected && styles.pointIconSelected]}>
          <MaterialCommunityIcons
            name={kind === 'pickup' ? 'map-marker-up' : 'map-marker-down'}
            size={19}
            color={selected ? '#FFFFFF' : '#6750A4'}
          />
        </View>
        <View style={styles.stopChoiceCopy}>
          <Text variant="titleSmall" style={styles.stopName}>{item.name}</Text>
          <Text variant="bodySmall" style={styles.stopAddress}>{item.address}</Text>
        </View>
        <View style={styles.stopTime}>
          <Text variant="labelLarge" style={styles.timeText}>{item.time}</Text>
          <Text variant="labelSmall" style={styles.timeLabel}>{kind === 'pickup' ? 'DEPARTS' : 'ARRIVES'}</Text>
        </View>
      </View>
    </Pressable>
  );
}

export default function BusTripDetailsView({
  details,
  loading,
  error,
  onRetry,
  selectedBoardingPoint,
  selectedDroppingPoint,
  onSelectBoardingPoint,
  onSelectDroppingPoint,
}) {
  const stops = details?.route?.stops || [];
  const boardingIndex = stops.findIndex((stop) => stop.stopId === selectedBoardingPoint?.stopId);
  const dropoffOptions = stops.filter((stop, index) => index > Math.max(boardingIndex, -1));
  const formatTime = (value) => {
    if (!value) return 'Time unavailable';
    const date = new Date(value);
    return Number.isNaN(date.getTime())
      ? 'Time unavailable'
      : date.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
  };
  const averageRating = details?.rating?.average;
  const roundedRating = averageRating === null || averageRating === undefined
    ? 0
    : Math.min(5, Math.max(0, Math.round(averageRating)));
  const ratingStars = averageRating === null || averageRating === undefined
    ? 'No rating yet'
    : `${'★'.repeat(roundedRating)}${'☆'.repeat(5 - roundedRating)}`;

  return (
    <View>
      <SectionHeading title="About this bus" subtitle="Bus and operator information from this schedule" />
      {loading ? (
        <View style={styles.loading}><ActivityIndicator size="large" color="#6750A4" /></View>
      ) : error ? (
        <Card style={styles.card}>
          <Card.Content>
            <Text accessibilityRole="alert" style={styles.errorText}>{error}</Text>
            <Button mode="text" onPress={onRetry}>Try again</Button>
          </Card.Content>
        </Card>
      ) : details ? (
        <>
          <Card style={styles.card}>
            <Card.Content>
              <View style={styles.registrationRow}>
                <View style={styles.busIcon}>
                  <MaterialCommunityIcons name="bus" size={22} color="#6750A4" />
                </View>
                <View style={styles.registrationCopy}>
                  <Text variant="labelSmall" style={styles.eyebrow}>VEHICLE NUMBER</Text>
                  <Text variant="titleMedium" style={styles.registration}>{details.bus.number}</Text>
                </View>
              </View>
              <Text variant="titleMedium" style={styles.model}>{details.bus.type}</Text>
              <Text variant="bodyMedium" style={styles.description}>
                {details.bus.operator} · {details.bus.capacity} seats
                {details.bus.hasUpperDeck ? ' · Upper deck' : ''}
              </Text>
            </Card.Content>
          </Card>

          <SectionHeading
            title="Route"
            subtitle={`${details.route.origin} to ${details.route.destination} · ${details.route.distanceKm} km · ${details.route.durationMinutes} min`}
          />
          <Card style={styles.card}>
            <Card.Content style={styles.timeline}>
              {stops.map((stop, index) => (
                <View key={stop.stopId} style={styles.timelineRow}>
                  <View style={styles.timelineTrack}>
                    <View style={[styles.timelineDot, index === stops.length - 1 && styles.timelineDotFinal]} />
                    {index < stops.length - 1 && <View style={styles.timelineLine} />}
                  </View>
                  <View style={styles.timelineTime}>
                    <Text variant="labelLarge" style={styles.timeText}>
                      {formatTime(stop.departureTime || stop.arrivalTime)}
                    </Text>
                  </View>
                  <View style={[styles.timelineContent, index === stops.length - 1 && styles.timelineLast]}>
                    <Text variant="titleSmall" style={styles.stopName}>{stop.name}</Text>
                    {stop.landmark ? <Text variant="bodySmall" style={styles.stopAddress}>{stop.landmark}</Text> : null}
                  </View>
                </View>
              ))}
            </Card.Content>
          </Card>

          <SectionHeading title="Choose boarding point" subtitle="Select a stop before your drop-off" />
          {stops.slice(0, -1).map((stop) => (
            <StopChoice
              key={`boarding-${stop.stopId}`}
              item={{ ...stop, time: formatTime(stop.departureTime || stop.arrivalTime), address: stop.landmark }}
              kind="pickup"
              selected={selectedBoardingPoint?.stopId === stop.stopId}
              onPress={() => onSelectBoardingPoint(stop)}
            />
          ))}
          {!stops.length ? <Text style={styles.subtitle}>No route stops are available for this schedule.</Text> : null}

          <SectionHeading title="Choose dropping point" subtitle="Only stops after the selected boarding point are available" />
          {dropoffOptions.map((stop) => (
            <StopChoice
              key={`dropoff-${stop.stopId}`}
              item={{ ...stop, time: formatTime(stop.arrivalTime || stop.departureTime), address: stop.landmark }}
              kind="dropoff"
              selected={selectedDroppingPoint?.stopId === stop.stopId}
              onPress={() => onSelectDroppingPoint(stop)}
            />
          ))}

          <SectionHeading
            title="Ratings & reviews"
            subtitle={`${details.rating.count} passenger review${details.rating.count === 1 ? '' : 's'}`}
          />
          <Card style={styles.ratingCard}>
            <Card.Content>
              <View style={styles.ratingSummary}>
                <Text variant="displaySmall" style={styles.ratingNumber}>
                  {details.rating.average === null ? '—' : details.rating.average.toFixed(1)}
                </Text>
                <View style={styles.ratingSummaryCopy}>
                  <Text style={styles.stars}>
                    {ratingStars}
                  </Text>
                  <Text variant="bodySmall" style={styles.subtitle}>
                    {details.rating.average === null ? 'No rating data available' : 'out of 5'}
                  </Text>
                </View>
              </View>
            </Card.Content>
          </Card>

          {details.reviews.length ? details.reviews.map((review, index) => (
            <Card key={`${review.createdAt}-${index}`} style={styles.reviewCard}>
              <Card.Content>
                <View style={styles.reviewHeader}>
                  <View style={styles.reviewerAvatar}>
                    <Text variant="titleSmall" style={styles.reviewerInitial}>{review.reviewer[0]}</Text>
                  </View>
                  <View style={styles.reviewerCopy}>
                    <Text variant="titleSmall" style={styles.stopName}>{review.reviewer}</Text>
                    <Text variant="bodySmall" style={styles.stopAddress}>
                      {new Date(review.createdAt).toLocaleDateString('en-IN')}
                    </Text>
                  </View>
                  <View style={styles.reviewRating}>
                    <MaterialCommunityIcons name="star" size={15} color="#D97706" />
                    <Text variant="labelLarge" style={styles.ratingValue}>{review.rating}.0</Text>
                  </View>
                </View>
                <Text variant="bodyMedium" style={styles.reviewText}>{review.text}</Text>
              </Card.Content>
            </Card>
          )) : (
            <Text variant="bodyMedium" style={styles.subtitle}>No passenger reviews have been added yet.</Text>
          )}
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionHeading: { marginTop: 18, marginBottom: 10 },
  sectionTitle: { color: '#1D1B20', fontWeight: '700' },
  subtitle: { color: '#625B71', marginTop: 3 },
  loading: { alignItems: 'center', paddingVertical: 28 },
  errorText: { color: '#B3261E' },
  card: { borderRadius: 18, backgroundColor: '#FFFBFE', marginBottom: 4 },
  registrationRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 },
  busIcon: { width: 42, height: 42, borderRadius: 14, backgroundColor: '#EADDFF', alignItems: 'center', justifyContent: 'center', marginRight: 11 },
  registrationCopy: { flex: 1 },
  eyebrow: { color: '#79747E', letterSpacing: 0.8 },
  registration: { color: '#1D1B20', fontWeight: '700', marginTop: 2 },
  model: { color: '#1D1B20', fontWeight: '700' },
  description: { color: '#625B71', marginTop: 6, lineHeight: 21 },
  timeline: { paddingTop: 16, paddingBottom: 8 },
  timelineRow: { minHeight: 61, flexDirection: 'row' },
  timelineTrack: { width: 20, alignItems: 'center' },
  timelineDot: { width: 11, height: 11, borderRadius: 6, borderWidth: 2, borderColor: '#6750A4', backgroundColor: '#FFFBFE', zIndex: 1 },
  timelineDotFinal: { borderColor: '#047857', backgroundColor: '#D1FAE5' },
  timelineLine: { position: 'absolute', top: 10, bottom: -1, width: 2, backgroundColor: '#D8D2E3' },
  timelineTime: { width: 67, paddingLeft: 5 },
  timeText: { color: '#6750A4', fontWeight: '700' },
  timelineContent: { flex: 1, paddingBottom: 14 },
  timelineLast: { paddingBottom: 0 },
  stopName: { color: '#1D1B20', fontWeight: '700' },
  stopAddress: { color: '#625B71', marginTop: 2, lineHeight: 18 },
  stopChoice: { backgroundColor: '#FFFBFE', borderColor: '#E7E0EC', borderWidth: 1, borderRadius: 16, padding: 12, marginBottom: 9 },
  stopChoiceSelected: { borderColor: '#6750A4', backgroundColor: '#F5F0FF' },
  stopChoiceHeader: { flexDirection: 'row', alignItems: 'center' },
  pointIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 12, backgroundColor: '#F3F0F8' },
  pointIconSelected: { backgroundColor: '#6750A4' },
  stopChoiceCopy: { flex: 1, paddingHorizontal: 10 },
  stopTime: { alignItems: 'flex-end' },
  ratingCard: { borderRadius: 18, backgroundColor: '#FFFBFE', marginBottom: 10 },
  ratingSummary: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 },
  ratingNumber: { color: '#1D1B20', fontWeight: '700' },
  ratingSummaryCopy: { marginLeft: 12 },
  stars: { color: '#D97706', fontSize: 19, letterSpacing: 2 },
  ratingValue: { color: '#1D1B20', fontWeight: '700' },
  reviewCard: { borderRadius: 18, backgroundColor: '#FFFBFE', marginBottom: 10 },
  reviewHeader: { flexDirection: 'row', alignItems: 'center' },
  reviewerAvatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#EADDFF', alignItems: 'center', justifyContent: 'center' },
  reviewerInitial: { color: '#4F378B', fontWeight: '700' },
  reviewerCopy: { flex: 1, marginLeft: 10 },
  reviewRating: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  reviewText: { color: '#49454F', marginTop: 10, lineHeight: 21 },
});

import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import {
  createDrawerNavigator,
  DrawerContentScrollView,
  DrawerItem,
} from '@react-navigation/drawer';
import { Ionicons } from '@expo/vector-icons';
import { Avatar, Text } from 'react-native-paper';

import AuthScreen from '../screens/AuthScreen';
import HomeScreen from '../screens/HomeScreen';
import BusListScreen from '../screens/BusListScreen';
import BookingScreen from '../screens/BookingScreen';
import BookingSummaryScreen from '../screens/BookingSummaryScreen';
import SeatSelectionScreen from '../screens/SeatSelectionScreen';
import SyncScreen from '../screens/SyncScreen';
import ReservationManagementScreen from '../screens/ReservationManagementScreen';
import UserRoleManagementScreen from '../screens/UserRoleManagementScreen';
import LocationManagementScreen from '../screens/LocationManagementScreen';
import BusManagementScreen from '../screens/BusManagementScreen';
import ScheduleManagementScreen from '../screens/ScheduleManagementScreen';
import DashboardScreen from '../screens/DashboardScreen';
import { useAuth } from '../context/AuthContext';

const Stack = createStackNavigator();
const Tab = createBottomTabNavigator();
const Drawer = createDrawerNavigator();

function CustomDrawerContent(props) {
  const { navigation } = props;
  const { user, signOut } = useAuth();
  const canManageReservations = ['OperatorAdmin', 'SystemAdmin'].includes(user?.role);
  const isSystemAdmin = user?.role === 'SystemAdmin';
  const canViewDashboard = ['Conductor', 'OperatorAdmin', 'SystemAdmin'].includes(user?.role);

  return (
    <DrawerContentScrollView {...props} contentContainerStyle={styles.drawerContent}>
      <View style={styles.drawerProfile}>
        <Avatar.Icon size={52} icon="account" style={styles.drawerAvatar} />
        <Text variant="titleMedium" style={styles.drawerUserName} numberOfLines={1}>
          {user?.name || 'Passenger'}
        </Text>
        <Text variant="bodySmall" style={styles.drawerCaption}>Bus Booking</Text>
      </View>
      <View style={styles.drawerItems}>
        <DrawerItem
          label="Home"
          icon={({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />}
          onPress={() => navigation.navigate('MainFlow', {
            screen: 'MainTabs',
            params: { screen: 'Home' },
          })}
        />
        <DrawerItem
          label="My bookings"
          icon={({ color, size }) => <Ionicons name="ticket-outline" size={size} color={color} />}
          onPress={() => navigation.navigate('MainFlow', {
            screen: 'MainTabs',
            params: { screen: 'Bookings' },
          })}
        />
        <DrawerItem
          label="Sync bookings"
          icon={({ color, size }) => <Ionicons name="sync-outline" size={size} color={color} />}
          onPress={() => navigation.navigate('MainFlow', {
            screen: 'MainTabs',
            params: { screen: 'Sync' },
          })}
        />
        {canViewDashboard ? (
          <DrawerItem
            label="Operations dashboard"
            icon={({ color, size }) => <Ionicons name="analytics-outline" size={size} color={color} />}
            onPress={() => navigation.navigate('MainFlow', { screen: 'Dashboard' })}
          />
        ) : null}
        {canManageReservations ? (
          <DrawerItem
            label="Manage reservations"
            icon={({ color, size }) => <Ionicons name="clipboard-outline" size={size} color={color} />}
            onPress={() => navigation.navigate('MainFlow', { screen: 'ReservationManagement' })}
          />
        ) : null}
        {isSystemAdmin ? (
          <DrawerItem
            label="Manage user roles"
            icon={({ color, size }) => <Ionicons name="people-outline" size={size} color={color} />}
            onPress={() => navigation.navigate('MainFlow', { screen: 'UserRoleManagement' })}
          />
        ) : null}
        {isSystemAdmin ? (
          <DrawerItem
            label="Manage locations"
            icon={({ color, size }) => <Ionicons name="location-outline" size={size} color={color} />}
            onPress={() => navigation.navigate('MainFlow', { screen: 'LocationManagement' })}
          />
        ) : null}
        {['OperatorAdmin', 'SystemAdmin'].includes(user?.role) ? (
          <DrawerItem
            label="Manage buses"
            icon={({ color, size }) => <Ionicons name="bus-outline" size={size} color={color} />}
            onPress={() => navigation.navigate('MainFlow', { screen: 'BusManagement' })}
          />
        ) : null}
        {['OperatorAdmin', 'SystemAdmin'].includes(user?.role) ? (
          <DrawerItem
            label="Manage journeys"
            icon={({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />}
            onPress={() => navigation.navigate('MainFlow', { screen: 'ScheduleManagement' })}
          />
        ) : null}
        {isSystemAdmin ? (
          <DrawerItem
            label="Manage route stops"
            icon={({ color, size }) => <Ionicons name="git-branch-outline" size={size} color={color} />}
            onPress={() => navigation.navigate('MainFlow', {
              screen: 'RouteStopManagement',
              params: { panel: 'routes' },
            })}
          />
        ) : null}
      </View>
      <View style={styles.drawerFooter}>
        <DrawerItem
          label="Log out"
          icon={({ color, size }) => <Ionicons name="log-out-outline" size={size} color={color} />}
          onPress={signOut}
        />
      </View>
    </DrawerContentScrollView>
  );
}

function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: '#6750A4',
        tabBarInactiveTintColor: '#79747E',
        tabBarStyle: {
          backgroundColor: '#FFFBFE',
          borderTopColor: '#E7E0EC',
          height: 64,
          paddingBottom: 8,
        },
        tabBarIcon: ({ color, size }) => {
          let iconName = 'home';

          if (route.name === 'Home') iconName = 'home';
          if (route.name === 'Bookings') iconName = 'ticket';
          if (route.name === 'Sync') iconName = 'sync';

          return <Ionicons name={iconName} size={size} color={color} />;
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Bookings" component={BookingScreen} />
      <Tab.Screen name="Sync" component={SyncScreen} />
    </Tab.Navigator>
  );
}

function MainFlow() {
  const { user } = useAuth();
  const role = user?.role;

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="BusList" component={BusListScreen} />
      <Stack.Screen name="SeatSelection" component={SeatSelectionScreen} />
      <Stack.Screen name="BookingSummary" component={BookingSummaryScreen} />
      {['Conductor', 'OperatorAdmin', 'SystemAdmin'].includes(role) && (
        <Stack.Screen name="Dashboard" component={DashboardScreen} />
      )}
      {['OperatorAdmin', 'SystemAdmin'].includes(role) && (
        <Stack.Screen name="ReservationManagement" component={ReservationManagementScreen} />
      )}
      {role === 'SystemAdmin' && (
        <Stack.Screen name="UserRoleManagement" component={UserRoleManagementScreen} />
      )}
      {role === 'SystemAdmin' && (
        <Stack.Screen name="LocationManagement" component={LocationManagementScreen} />
      )}
      {role === 'SystemAdmin' && (
        <Stack.Screen
          name="RouteStopManagement"
          component={LocationManagementScreen}
          initialParams={{ panel: 'routes' }}
        />
      )}
      {['OperatorAdmin', 'SystemAdmin'].includes(role) && (
        <Stack.Screen name="BusManagement" component={BusManagementScreen} />
      )}
      {['OperatorAdmin', 'SystemAdmin'].includes(role) && (
        <Stack.Screen name="ScheduleManagement" component={ScheduleManagementScreen} />
      )}
    </Stack.Navigator>
  );
}

function MainDrawer() {
  return (
    <Drawer.Navigator
      drawerContent={(props) => <CustomDrawerContent {...props} />}
      screenOptions={{
        drawerActiveTintColor: '#6750A4',
        drawerInactiveTintColor: '#49454F',
        drawerActiveBackgroundColor: '#EADDFF',
        drawerLabelStyle: { fontWeight: '600' },
        drawerStyle: { backgroundColor: '#FFFBFE', width: 300 },
        headerStyle: { backgroundColor: '#F3F4F8' },
        headerTintColor: '#1D1B20',
        headerTitle: 'Bus Booking',
        headerTitleStyle: { fontWeight: '700' },
      }}
    >
      <Drawer.Screen
        name="MainFlow"
        component={MainFlow}
        options={{ title: 'Bus Booking' }}
      />
    </Drawer.Navigator>
  );
}

export default function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <View style={styles.loaderWrap}>
        <ActivityIndicator size="large" color="#2563EB" />
      </View>
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {user ? (
          <Stack.Screen name="MainDrawer" component={MainDrawer} />
        ) : (
          <Stack.Screen name="Auth" component={AuthScreen} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  loaderWrap: {
    flex: 1,
    backgroundColor: '#0B1220',
    alignItems: 'center',
    justifyContent: 'center',
  },
  drawerContent: {
    flexGrow: 1,
  },
  drawerProfile: {
    alignItems: 'flex-start',
    backgroundColor: '#F3F4F8',
    marginHorizontal: 12,
    marginTop: 8,
    padding: 18,
    borderRadius: 20,
  },
  drawerAvatar: {
    backgroundColor: '#6750A4',
    marginBottom: 12,
  },
  drawerUserName: {
    color: '#1D1B20',
    fontWeight: '700',
    maxWidth: '100%',
  },
  drawerCaption: {
    color: '#625B71',
    marginTop: 2,
  },
  drawerItems: {
    paddingTop: 16,
  },
  drawerFooter: {
    borderTopColor: '#E7E0EC',
    borderTopWidth: StyleSheet.hairlineWidth,
    marginTop: 'auto',
    paddingTop: 8,
  },
});

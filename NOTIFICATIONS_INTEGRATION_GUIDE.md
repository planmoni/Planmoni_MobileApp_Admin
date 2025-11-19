# Push Notifications Integration Guide

## Overview
The Admin Push Notifications system has been successfully implemented. This guide provides instructions for integrating the mobile app with the push notification infrastructure.

## Admin Dashboard Implementation ✅

### Completed Features:
1. **Database Schema** - Created complete push notifications infrastructure
2. **Edge Function** - Deployed `admin-push-notifications` function for sending notifications
3. **Admin UI** - Added Notifications page with full management capabilities
4. **Sidebar Integration** - Added Notifications menu item
5. **Permissions** - Added notification permissions for role-based access control

### Database Tables Created:
- `user_push_tokens` - Stores Expo push tokens for users
- `push_notification_segments` - Defines user groups for targeted notifications
- `push_notifications` - Stores notification campaign records
- `push_notification_logs` - Tracks individual delivery attempts

## Mobile App Integration Requirements

### 1. Install Required Dependencies

```bash
npm install expo-notifications expo-device expo-constants
```

### 2. Configure Push Notifications in Mobile App

Add the following to your `app.json`:

```json
{
  "expo": {
    "notification": {
      "icon": "./assets/notification-icon.png",
      "color": "#1E3A8A"
    },
    "android": {
      "useNextNotificationsApi": true,
      "googleServicesFile": "./google-services.json"
    },
    "ios": {
      "infoPlist": {
        "UIBackgroundModes": ["remote-notification"]
      }
    }
  }
}
```

### 3. Register for Push Notifications

Create a notification service in your mobile app:

```typescript
// services/pushNotifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { supabase } from './supabase';

// Configure notification handling behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function registerForPushNotificationsAsync() {
  let token;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#1E3A8A',
    });
  }

  if (Device.isDevice) {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Failed to get push token for push notification!');
      return;
    }

    token = (await Notifications.getExpoPushTokenAsync({
      projectId: Constants.expoConfig?.extra?.eas?.projectId,
    })).data;

    console.log('Expo Push Token:', token);
  } else {
    console.log('Must use physical device for Push Notifications');
  }

  return token;
}

export async function savePushTokenToDatabase(expoPushToken: string, userId: string) {
  try {
    const deviceInfo = {
      platform: Platform.OS,
      version: Platform.Version,
      model: Device.modelName,
    };

    // Check if token already exists
    const { data: existingToken } = await supabase
      .from('user_push_tokens')
      .select('id')
      .eq('expo_push_token', expoPushToken)
      .eq('user_id', userId)
      .maybeSingle();

    if (existingToken) {
      // Update existing token
      const { error } = await supabase
        .from('user_push_tokens')
        .update({
          device_info: deviceInfo,
          is_active: true,
          last_used: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existingToken.id);

      if (error) throw error;
    } else {
      // Insert new token
      const { error } = await supabase
        .from('user_push_tokens')
        .insert({
          user_id: userId,
          expo_push_token: expoPushToken,
          device_info: deviceInfo,
          is_active: true,
        });

      if (error) throw error;
    }

    console.log('Push token saved to database');
  } catch (error) {
    console.error('Error saving push token:', error);
  }
}
```

### 4. Initialize Notifications on App Start

In your main App component or root navigator:

```typescript
import { useEffect, useRef } from 'react';
import * as Notifications from 'expo-notifications';
import { registerForPushNotificationsAsync, savePushTokenToDatabase } from './services/pushNotifications';
import { useAuth } from './contexts/AuthContext';

function App() {
  const { user } = useAuth();
  const notificationListener = useRef<any>();
  const responseListener = useRef<any>();

  useEffect(() => {
    if (user) {
      // Register for push notifications
      registerForPushNotificationsAsync().then(token => {
        if (token) {
          savePushTokenToDatabase(token, user.id);
        }
      });

      // Listen for incoming notifications
      notificationListener.current = Notifications.addNotificationReceivedListener(notification => {
        console.log('Notification received:', notification);
        // Handle the notification in foreground
      });

      // Listen for notification responses
      responseListener.current = Notifications.addNotificationResponseReceivedListener(response => {
        console.log('Notification response:', response);
        // Handle navigation based on notification data
        const data = response.notification.request.content.data;
        // Navigate to relevant screen based on data
      });

      return () => {
        if (notificationListener.current) {
          Notifications.removeNotificationSubscription(notificationListener.current);
        }
        if (responseListener.current) {
          Notifications.removeNotificationSubscription(responseListener.current);
        }
      };
    }
  }, [user]);

  // Rest of your app...
}
```

### 5. Handle Notification Navigation

Add navigation logic based on notification data:

```typescript
function handleNotificationNavigation(data: any) {
  if (data.type === 'payout') {
    navigation.navigate('PayoutDetails', { id: data.payoutId });
  } else if (data.type === 'kyc') {
    navigation.navigate('KYCStatus');
  } else if (data.type === 'announcement') {
    navigation.navigate('Announcements');
  }
  // Add more navigation cases as needed
}
```

### 6. Test Push Notifications

1. Run your mobile app on a physical device (required for push notifications)
2. Log in with a user account
3. Verify the push token is saved to the database:
   ```sql
   SELECT * FROM user_push_tokens WHERE user_id = 'YOUR_USER_ID';
   ```
4. From the admin dashboard, go to Notifications page
5. Create and send a test notification to "All Users" or a specific segment
6. Verify the notification appears on your mobile device

## Admin Dashboard Usage

### Accessing the Notifications Page
1. Log in to the admin dashboard
2. Click on "Notifications" in the sidebar (Bell icon)

### Sending a Push Notification
1. Click "Send Notification" button
2. Fill in the notification details:
   - **Title**: Short notification title (max 100 characters)
   - **Message**: Notification body (max 200 characters)
   - **Target Audience**: Choose "All Users" or "User Segment"
   - **Segment**: If targeting a segment, select from predefined segments
3. Preview the notification in the preview box
4. Click "Send Notification" to deliver immediately

### Viewing Notification History
- The main page displays all sent notifications
- View delivery statistics: Total recipients, delivered count, failed count, and delivery rate
- Filter notifications by status (Sent, Sending, Scheduled, Failed, Draft)
- Search notifications by title or message content

### Available User Segments
- **All Users**: All registered users
- **Active Users**: Users with active payout plans
- **KYC Completed**: Users who have completed KYC verification
- **New Users**: Users who joined in the last 30 days
- **High Value Users**: Users with total deposits over 10,000

## API Endpoints

### Edge Function Endpoint
```
POST https://YOUR_SUPABASE_URL/functions/v1/admin-push-notifications
```

### Request Format
```json
{
  "action": "send_notification",
  "title": "Notification Title",
  "body": "Notification message",
  "data": {
    "type": "announcement",
    "customField": "value"
  },
  "target_type": "all",
  "target_segment_id": "segment-uuid"
}
```

### Response Format
```json
{
  "success": true,
  "message": "Notification sent to 150 recipients (2 failed)",
  "notification_id": "notification-uuid",
  "delivered_count": 148,
  "failed_count": 2,
  "total_recipients": 150
}
```

## Troubleshooting

### Push Token Not Saving
- Verify user is authenticated
- Check database RLS policies allow user to insert their own token
- Ensure Supabase connection is working in mobile app

### Notifications Not Received
- Verify device has granted notification permissions
- Ensure using a physical device (push notifications don't work on simulators)
- Check that push token is valid and active in database
- Verify Expo push token format is correct

### Delivery Failures
- Check `push_notification_logs` table for error messages
- Verify push tokens are valid Expo tokens
- Ensure mobile app is using latest expo-notifications package

## Security Considerations

- Push tokens are stored securely with RLS policies
- Only admins can send notifications (verified by is_admin flag)
- Users can only view/update their own push tokens
- All notification sends are logged with admin user ID
- Edge function validates admin permissions before sending

## Next Steps

1. Implement the mobile app integration following this guide
2. Test push notifications on physical devices
3. Configure additional notification segments as needed
4. Set up notification templates for common use cases
5. Monitor delivery rates and adjust strategy accordingly

## Support

For issues or questions:
- Check the Edge Function logs in Supabase dashboard
- Review the `push_notification_logs` table for delivery errors
- Verify RLS policies are correctly configured
- Ensure all environment variables are set correctly

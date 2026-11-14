import React, { useCallback, useContext, useEffect } from 'react'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import { NavigationContainer, DefaultTheme } from '@react-navigation/native'
import { CardStyleInterpolators, createStackNavigator } from '@react-navigation/stack'
import AsyncStorage from '@react-native-async-storage/async-storage'
import navigationService from './navigationService'
import * as Notifications from 'expo-notifications'
import CreateAccount from '../screens/CreateAccount/CreateAccount'
import ItemDetail from '../screens/ItemDetail/ItemDetail'
import MyOrders from '../screens/MyOrders/MyOrders'
import Cart from '../screens/Cart/Cart'
import SaveAddress from '../screens/SaveAddress/SaveAddress'
import RateAndReview from '../screens/RateAndReview/RateAndReview'
import Payment from '../screens/Payment/Payment'
import Help from '../screens/Help/Help'
import Profile from '../screens/Profile/Profile'
import Addresses from '../screens/Addresses/Addresses'
import NewAddress from '../screens/NewAddress/NewAddress'
import EditAddress from '../screens/EditAddress/EditAddress'
import CartAddress from '../screens/CartAddress/CartAddress'
import FullMap from '../screens/FullMap/FullMap'
import OrderDetail from '../screens/OrderDetail/OrderDetail'
import Settings from '../screens/Settings/Settings'
import HelpBrowser from '../screens/HelpBrowser/HelpBrowser'
import Main from '../screens/Main/Main'
import Restaurant from '../screens/Restaurant/Restaurant'
import About from '../screens/About'
import SelectLocation from '../screens/SelectLocation'
import AddNewAddress from '../screens/SelectLocation/AddNewAddress'
import CurrentLocation from '../screens/CurrentLocation'
import ThemeContext from '../ui/ThemeContext/ThemeContext'
import { theme } from '../utils/themeColors'
import screenOptions from './screenOptions'
import { LocationContext } from '../context/Location'
import Reorder from '../screens/Reorder/Reorder'
import Favourite from '../screens/Favourite/Favourite'
import ChatScreen from '../screens/ChatWithRider/ChatScreen'
import Coins from '../screens/Coins/Coins'
import Wallet from '../screens/Wallet/Wallet'
import { DarkBackButton, RightButton } from '../components/Header/HeaderIcons/HeaderIcons'
import PhoneOtp from '../screens/Otp/Phone/PhoneOtp'
import { useApolloClient, gql } from '@apollo/client'
import { myOrders } from '../apollo/queries'
import Checkout from '../screens/Checkout/Checkout'
import Menu from '../screens/Menu/Menu'
import Reviews from '../screens/Reviews'
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import BottomTabIcon from '../components/BottomTabIcon/BottomTabIcon'
import { useTranslation } from 'react-i18next'
import Collection from '../screens/Collection/Collection'
import MapSection from '../screens/MapSection'
import Account from '../screens/Account/Account'
import EditName from '../components/Account/EditName/EditName'
import SearchScreen from '../screens/Search/SearchScreen'
import UserContext from '../context/User'
import AuthContext from '../context/Auth'
import { Easing, Platform, View } from 'react-native'
import CategoryPage from '../components/SubCategoryPage/SubCategoryPage'
// import HypCheckout from '../screens/Hyp/HypCheckout'
import NewRestaurantDetailDesign from '../components/NewRestaurantDetailDesign/RestaurantDetailDesign'
import { SLIDE_RIGHT_WITH_CURVE_ANIM, SLIDE_UP_RIGHT_ANIMATION, AIMATE_FROM_CENTER, SLIDE_UP_RIGHT_ANIMATION_FIXED_HEADER } from '../utils/constants'
import * as LocationImport from 'expo-location'

const NavigationStack = createStackNavigator()
const Location = createStackNavigator()
const AuthNavigator = createStackNavigator()
const Tab = createBottomTabNavigator()

function MainNavigator() {
  const themeContext = useContext(ThemeContext)
  const currentTheme = theme[themeContext.ThemeValue]

  return (
    <NavigationStack.Navigator
      screenOptions={screenOptions({
        theme: themeContext.ThemeValue,
        headerMenuBackground: currentTheme.headerMenuBackground,
        backColor: currentTheme.headerBackground,
        lineColor: currentTheme.horizontalLine,
        textColor: currentTheme.headerText,
        iconColor: currentTheme.iconColorPink,
        headerShown: false
      })}
    >
      <NavigationStack.Screen
        name='Main'
        component={BottomTabNavigator}
        options={{
          headerShown: false,
          gestureDirection: 'vertical-inverted',
          cardStyleInterpolator: CardStyleInterpolators.forScaleFromCenterAndroid
        }}
      />
      <NavigationStack.Screen name='Menu' component={Menu} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen
        name='NewRestaurantDetailDesign'
        component={NewRestaurantDetailDesign}
        options={{
          header: () => null,
          ...AIMATE_FROM_CENTER
        }}
      />
      <NavigationStack.Screen
        name='CategoryPage'
        component={CategoryPage}
        options={{
          header: () => null,
          ...SLIDE_RIGHT_WITH_CURVE_ANIM
        }}
      />
      <NavigationStack.Screen
        name='Restaurant'
        component={Restaurant}
        options={{
          header: () => null,
          ...AIMATE_FROM_CENTER
        }}
      />
      <NavigationStack.Screen name='ItemDetail' component={ItemDetail} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen name='Cart' component={Cart} options={SLIDE_UP_RIGHT_ANIMATION_FIXED_HEADER} />
      <NavigationStack.Screen name='Checkout' component={Checkout} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen name='Profile' component={Profile} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen name='Addresses' component={Addresses} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen name='NewAddress' component={NewAddress} />
      <NavigationStack.Screen name='EditAddress' component={EditAddress} />
      <NavigationStack.Screen name='FullMap' component={FullMap} options={SLIDE_UP_RIGHT_ANIMATION} />
      <NavigationStack.Screen name='CartAddress' component={CartAddress} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen name='Payment' component={Payment} />
      <NavigationStack.Screen
        name='OrderDetail'
        component={OrderDetail}
        options={{
          // headerTransparent: true,
          // headerRight: null,
          // title: '',
          headerBackImage: () =>
            DarkBackButton({
              iconColor: currentTheme.backIcon,
              iconBackground: currentTheme.backIconBackground
            }),
          ...SLIDE_RIGHT_WITH_CURVE_ANIM
        }}
      />
      <NavigationStack.Screen name='Settings' component={Settings} />
      <NavigationStack.Screen name='MyOrders' component={MyOrders} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen name='Reorder' component={Reorder} />
      <NavigationStack.Screen name='Help' component={Help} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen name='HelpBrowser' component={HelpBrowser} />
      <NavigationStack.Screen name='About' component={About} options={{ header: () => null, ...SLIDE_RIGHT_WITH_CURVE_ANIM }} />
      <NavigationStack.Screen name='Reviews' component={Reviews} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen name='RateAndReview' component={RateAndReview} />


      {/* Authentication Login */}
      <NavigationStack.Screen name='CreateAccount' component={CreateAccount} />
      <NavigationStack.Screen name='PhoneOtp' component={PhoneOtp} />
      <NavigationStack.Screen name='SelectLocation' component={SelectLocation} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen name='AddNewAddress' component={AddNewAddress} />
      <NavigationStack.Screen name='SaveAddress' component={SaveAddress} />
      <NavigationStack.Screen name='Favourite' component={Favourite} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen name='ChatWithRider' component={ChatScreen} />
      <NavigationStack.Screen name='Coins' component={Coins} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen name='Wallet' component={Wallet} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen name='Collection' component={Collection} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen name='MapSection' component={MapSection} options={SLIDE_UP_RIGHT_ANIMATION} />
      <NavigationStack.Screen name='Account' component={Account} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen name='EditName' component={EditName} />
      <NavigationStack.Screen name='SearchScreen' component={SearchScreen} />
      {/* <NavigationStack.Screen name='HypCheckout' component={HypCheckout} /> */}
    </NavigationStack.Navigator>
  )
}

function LocationStack() {
  return (
    <Location.Navigator>
      <Location.Screen name='CurrentLocation' component={CurrentLocation} options={{ header: () => null }} />
      <Location.Screen name='SelectLocation' component={SelectLocation} />
      <Location.Screen name='AddNewAddress' component={AddNewAddress} options={SLIDE_RIGHT_WITH_CURVE_ANIM} />
      <NavigationStack.Screen
        name='Main'
        component={BottomTabNavigator}
        options={{
          headerShown: false,
          gestureDirection: 'vertical-inverted',
          cardStyleInterpolator: CardStyleInterpolators.forScaleFromCenterAndroid
        }}
      />
    </Location.Navigator>
  )
}

// Shown to anyone who is not signed in: nobody can reach the app before registering.
function AuthStack() {
  return (
    <AuthNavigator.Navigator screenOptions={{ headerShown: false }}>
      <AuthNavigator.Screen name='CreateAccount' component={CreateAccount} />
      <AuthNavigator.Screen name='PhoneOtp' component={PhoneOtp} options={{ headerShown: true }} />
    </AuthNavigator.Navigator>
  )
}

function BottomTabNavigator() {
  const themeContext = useContext(ThemeContext)
  const currentTheme = theme[themeContext.ThemeValue]
  const { t } = useTranslation()
  const { profile: userProfile } = useContext(UserContext)
  return (
    <Tab.Navigator
      sceneContainerStyle={{ backgroundColor: currentTheme.themeBackground }}
      screenOptions={({ route }) => ({
        tabBarIcon: ({ focused, size }) => {
          // synced with BottomTabIcon, make sure to have the same name as icon in BottomTabIcon
          return (
            <View style={{ width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', backgroundColor: focused ? '#000' : 'transparent' }}>
              <BottomTabIcon name={route.name.toLowerCase()} size={size} color={focused ? '#F0B400' : 'rgba(0,0,0,0.65)'} />
            </View>
          )
        },
        // floating yellow pill, like the home design
        tabBarShowLabel: false,
        tabBarHideOnKeyboard: true,
        tabBarStyle: {
          marginHorizontal: 16,
          marginBottom: Platform.OS === 'ios' ? 24 : 12,
          height: 64,
          borderRadius: 32,
          borderTopWidth: 0,
          paddingVertical: 0,
          paddingHorizontal: 8,
          backgroundColor: '#F0B400',
          elevation: 8,
          shadowColor: '#000',
          shadowOpacity: 0.25,
          shadowRadius: 8,
          shadowOffset: { width: 0, height: 3 }
        },
        tabBarItemStyle: { height: 64, paddingVertical: 0 },
        tabBarActiveTintColor: '#000',
        tabBarInactiveTintColor: 'rgba(0,0,0,0.65)',
        headerRight: () => <RightButton icon='cart' iconColor={currentTheme.iconColor} menuHeader={false} t={t} />
      })}
    >
      <Tab.Screen
        name='Discovery'
        component={Main}
        options={{
          tabBarLabel: t('Discovery')
        }}
      />
      <Tab.Screen
        name='Restaurants'
        component={Menu}
        options={{
          tabBarLabel: t('Restaurants')
        }}
        initialParams={{
          selectedType: 'restaurant',
          queryType: 'restaurant'
        }}
      />
      <Tab.Screen
        name='Store'
        component={Menu}
        options={{
          tabBarLabel: t('Store')
        }}
        initialParams={{
          selectedType: 'grocery',
          queryType: 'grocery'
        }}
      />
      <Tab.Screen
        name='Search'
        component={SearchScreen}
        options={{
          tabBarLabel: t('search')
        }}
      />
      <Tab.Screen
        name='Profile'
        component={userProfile ? Profile : CreateAccount}
        options={{
          tabBarLabel: t('titleProfile')
        }}
      />
    </Tab.Navigator>
  )
}

function AppContainer() {
  const client = useApolloClient()
  const { permissionState, setPermissionState, location } = useContext(LocationContext)
  const { token, tokenLoaded } = useContext(AuthContext)
  const lastNotificationResponse = Notifications.useLastNotificationResponse()
  const appThemeContext = useContext(ThemeContext)
  const appTheme = theme[appThemeContext.ThemeValue]
  // The default navigation theme paints the area around the floating tab bar white/light gray.
  const navigationTheme = {
    ...DefaultTheme,
    colors: {
      ...DefaultTheme.colors,
      background: appTheme.themeBackground,
      card: appTheme.themeBackground,
      border: 'transparent'
    }
  }

  const [isLoadingPermission, setIsLoadingPermission] = React.useState(true)

  const handleNotification = useCallback(
    async (response) => {
      const { _id } = response.notification.request.content.data
      const lastNotificationHandledId = await AsyncStorage.getItem('@lastNotificationHandledId')
      await client.query({
        query: gql`
          ${myOrders}
        `,
        fetchPolicy: 'network-only'
      })
      const identifier = response.notification.request.identifier
      if (lastNotificationHandledId === identifier) return
      await AsyncStorage.setItem('@lastNotificationHandledId', identifier)
      navigationService.navigate('OrderDetail', {
        _id
      })
    },
    [lastNotificationResponse]
  )

  // Handlers
  const init = async () => {
    try {
      const permission_state = await LocationImport.getForegroundPermissionsAsync()

      setPermissionState(permission_state)
      setIsLoadingPermission(false)
    } finally {
      setIsLoadingPermission(false)
    }
  }

  useEffect(() => {
    init()
  }, [])

  useEffect(() => {
    if (lastNotificationResponse && lastNotificationResponse.notification.request.content.data?.type === 'order' && lastNotificationResponse.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      handleNotification(lastNotificationResponse)
    }
    // New chat message from the rider: open that order's conversation.
    const chatData = lastNotificationResponse?.notification?.request?.content?.data
    if (chatData?.type === 'chat' && (chatData?.orderId || chatData?._id) && lastNotificationResponse.actionIdentifier === Notifications.DEFAULT_ACTION_IDENTIFIER) {
      const identifier = lastNotificationResponse.notification.request.identifier
      AsyncStorage.getItem('@lastNotificationHandledId').then(async (last) => {
        if (last === identifier) return
        await AsyncStorage.setItem('@lastNotificationHandledId', identifier)
        navigationService.navigate('ChatWithRider', { id: chatData.orderId || chatData._id })
      })
    }
  }, [lastNotificationResponse])


  if (isLoadingPermission || !tokenLoaded) return null

  return (
    <SafeAreaProvider>
      <NavigationContainer
        theme={navigationTheme}
        ref={(ref) => {
          navigationService.setGlobalRef(ref)
        }}
      >
        {!token ? <AuthStack /> : !permissionState?.granted || !location ? <LocationStack /> : <MainNavigator />}

        {/* {<LocationStack />}
        <MainNavigator /> */}
      </NavigationContainer>
    </SafeAreaProvider>
  )
}

export default AppContainer

import { useMutation, useQuery } from '@apollo/client';
import {
  SEND_NOTIFICATION_USER,
  TICKET_USERS,
  USER_TICKETS,
  USERS,
} from '@/lib/graphql-docs';
import Constants from 'expo-constants';
import { useCallback, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from 'react-native';

import { Badge, Button, Card, EmptyState, ListFooter, Screen, TextField } from '../../../components/ui';
import { useAuth } from '../../../lib/auth/auth-context';
import { describeError } from '../../../lib/errors';
import { WEB_ADMIN_URL } from '../../../lib/config';
import type {
  ITicketUser,
  ITicketUsersPage,
  IUser,
  IUserTicketsPage,
} from '../../../lib/interfaces';
import { useI18n } from '../../../lib/i18n';
import { useTheme } from '../../../lib/theme';
import { formatDateTime, initials } from '../../../lib/utils/format';

type TPanel = 'users' | 'tickets' | 'notify' | null;

export default function MoreScreen() {
  const { colors, mode, setMode } = useTheme();
  const { t, locale, setLocale, isRtl } = useI18n();
  const { user, logout, biometricEnabled, setBiometricEnabled } = useAuth();

  const [panel, setPanel] = useState<TPanel>(null);
  const [selectedTicketUser, setSelectedTicketUser] = useState<ITicketUser | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [sending, setSending] = useState(false);

  const usersQuery = useQuery<{ users: IUser[] }>(USERS, {
    skip: panel !== 'users',
    fetchPolicy: 'cache-and-network',
  });
  const ticketUsersQuery = useQuery<{ getTicketUsers: ITicketUsersPage }>(TICKET_USERS, {
    variables: { page: 1, limit: 50 },
    skip: panel !== 'tickets',
    fetchPolicy: 'cache-and-network',
  });
  const userTicketsQuery = useQuery<{ getSingleUserSupportTickets: IUserTicketsPage }>(
    USER_TICKETS,
    {
      variables: { userId: selectedTicketUser?._id, page: 1, limit: 50 },
      skip: !selectedTicketUser,
      fetchPolicy: 'cache-and-network',
    },
  );

  const [sendNotification] = useMutation(SEND_NOTIFICATION_USER);

  const send = useCallback(() => {
    if (!body.trim()) return;
    setSending(true);
    sendNotification({ variables: { title: title.trim() || undefined, body: body.trim() } })
      .then(() => {
        setPanel(null);
        setTitle('');
        setBody('');
        Alert.alert(t('more.sent'));
      })
      .catch((err: unknown) => Alert.alert(t('common.error'), describeError(err, t)))
      .finally(() => setSending(false));
  }, [sendNotification, title, body, t]);

  const openWeb = useCallback(() => {
    void Linking.openURL(WEB_ADMIN_URL).catch(() => Alert.alert(t('common.error')));
  }, [t]);

  const row = (label: string, onPress: () => void, hint?: string) => (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.menuRow,
        { borderColor: colors.border, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <View style={styles.menuText}>
        <Text style={[styles.menuLabel, { color: colors.text }]}>{label}</Text>
        {hint ? <Text style={[styles.menuHint, { color: colors.textMuted }]}>{hint}</Text> : null}
      </View>
      <Text style={[styles.chevron, { color: colors.textMuted }]}>{isRtl ? '‹' : '›'}</Text>
    </Pressable>
  );

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <Text style={[styles.title, { color: colors.text }]}>{t('more.title')}</Text>

        <Card style={styles.profile}>
          <View style={[styles.avatar, { backgroundColor: colors.primary }]}>
            <Text style={[styles.avatarText, { color: colors.primaryText }]}>
              {initials(user?.name)}
            </Text>
          </View>
          <View style={styles.profileText}>
            <Text style={[styles.profileName, { color: colors.text }]}>
              {user?.name ?? t('common.na')}
            </Text>
            <Text style={[styles.menuHint, { color: colors.textMuted }]}>
              {user?.email ?? t('common.na')}
            </Text>
            <Badge label={user?.role ?? user?.userType ?? 'ADMIN'} tone="info" />
          </View>
        </Card>

        <Card style={styles.group}>
          {row(t('more.users'), () => setPanel('users'), t('more.usersHint'))}
          {row(t('more.support'), () => setPanel('tickets'), t('more.ticketsHint'))}
          {row(t('more.notifications'), () => setPanel('notify'), t('more.notificationHint'))}
        </Card>

        <Card style={styles.group}>
          <View style={styles.settingRow}>
            <View style={styles.menuText}>
              <Text style={[styles.menuLabel, { color: colors.text }]}>{t('more.language')}</Text>
              <Text style={[styles.menuHint, { color: colors.textMuted }]}>{t('more.languageHint')}</Text>
            </View>
            <View style={styles.segment}>
              {(['en', 'ar'] as const).map((value) => {
                const active = locale === value;
                return (
                  <Pressable
                    key={value}
                    onPress={() => setLocale(value)}
                    style={[
                      styles.segmentItem,
                      {
                        backgroundColor: active ? colors.primary : colors.surfaceMuted,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.segmentLabel, { color: active ? colors.primaryText : colors.text }]}>
                      {value === 'en' ? 'EN' : 'AR'}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.menuText}>
              <Text style={[styles.menuLabel, { color: colors.text }]}>{t('more.appearance')}</Text>
              <Text style={[styles.menuHint, { color: colors.textMuted }]}>{t('more.appearanceHint')}</Text>
            </View>
            <View style={styles.segment}>
              {(['light', 'dark', 'system'] as const).map((value) => {
                const active = mode === value || (value === 'system' && false);
                return (
                  <Pressable
                    key={value}
                    onPress={() => setMode(value)}
                    style={[
                      styles.segmentItem,
                      {
                        backgroundColor: active ? colors.primary : colors.surfaceMuted,
                        borderColor: active ? colors.primary : colors.border,
                      },
                    ]}
                  >
                    <Text style={[styles.segmentLabel, { color: active ? colors.primaryText : colors.text }]}>
                      {value === 'light' ? t('more.light') : value === 'dark' ? t('more.dark') : t('more.system')}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          <View style={styles.settingRow}>
            <View style={styles.menuText}>
              <Text style={[styles.menuLabel, { color: colors.text }]}>{t('more.biometric')}</Text>
              <Text style={[styles.menuHint, { color: colors.textMuted }]}>{t('more.biometricHint')}</Text>
            </View>
            <Switch
              value={biometricEnabled}
              onValueChange={(value) => void setBiometricEnabled(value)}
              trackColor={{ true: colors.primary, false: colors.surfaceMuted }}
            />
          </View>
        </Card>

        <Card style={styles.group}>
          {row(t('common.openWeb'), openWeb, t('more.openWebHint'))}
        </Card>

        <Button label={t('common.logout')} onPress={() => void logout()} variant="danger" />

        <Text style={[styles.version, { color: colors.textMuted }]}>
          {t('more.version')} {Constants.expoConfig?.version ?? '0.1.0'}
        </Text>
      </ScrollView>

      <Modal visible={panel !== null} transparent animationType="slide" onRequestClose={() => setPanel(null)}>
        <View style={styles.backdrop}>
          <View style={[styles.sheet, { backgroundColor: colors.surface }]}>
            <View style={styles.sheetHeader}>
              <Text style={[styles.sheetTitle, { color: colors.text }]}>
                {panel === 'users' ? t('more.users') : panel === 'tickets' ? t('more.support') : t('more.notifications')}
              </Text>
              <Pressable onPress={() => setPanel(null)}>
                <Text style={[styles.close, { color: colors.primary }]}>{t('common.close')}</Text>
              </Pressable>
            </View>

            {panel === 'users' ? (
              <ScrollView style={styles.sheetBody}>
                {usersQuery.loading && !usersQuery.data ? <ListFooter loading /> : null}
                {(usersQuery.data?.users ?? []).length === 0 && !usersQuery.loading ? (
                  <EmptyState title={t('more.noUsers')} />
                ) : null}
                {(usersQuery.data?.users ?? []).map((item) => (
                  <View key={item._id} style={[styles.listRow, { borderColor: colors.border }]}>
                    <View style={styles.menuText}>
                      <Text style={[styles.menuLabel, { color: colors.text }]}>{item.name ?? t('common.na')}</Text>
                      <Text style={[styles.menuHint, { color: colors.textMuted }]}>
                        {item.email ?? item.phone ?? t('common.na')}
                      </Text>
                    </View>
                    <Badge label={item.role ?? item.userType ?? 'USER'} tone={item.isActive ? 'success' : 'danger'} />
                  </View>
                ))}
              </ScrollView>
            ) : null}

            {panel === 'tickets' ? (
              selectedTicketUser ? (
                <ScrollView style={styles.sheetBody}>
                  <Pressable onPress={() => setSelectedTicketUser(null)} style={styles.backLink}>
                    <Text style={[styles.close, { color: colors.primary }]}>← {t('common.back')}</Text>
                  </Pressable>
                  {userTicketsQuery.loading && !userTicketsQuery.data ? <ListFooter loading /> : null}
                  {(userTicketsQuery.data?.getSingleUserSupportTickets.tickets ?? []).length === 0 ? (
                    <EmptyState title={t('more.noTickets')} />
                  ) : null}
                  {(userTicketsQuery.data?.getSingleUserSupportTickets.tickets ?? []).map((ticket) => (
                    <View key={ticket._id} style={[styles.listRow, { borderColor: colors.border }]}>
                      <View style={styles.menuText}>
                        <Text style={[styles.menuLabel, { color: colors.text }]}>{ticket.title ?? t('common.na')}</Text>
                        <Text style={[styles.menuHint, { color: colors.textMuted }]}>
                          {ticket.description ?? t('more.noDescription')}
                        </Text>
                        <Text style={[styles.menuHint, { color: colors.textMuted }]}>
                          {formatDateTime(ticket.createdAt)}
                        </Text>
                      </View>
                      <Badge label={ticket.status ?? 'OPEN'} tone="info" />
                    </View>
                  ))}
                </ScrollView>
              ) : (
                <ScrollView style={styles.sheetBody}>
                  {(ticketUsersQuery.data?.getTicketUsers.users ?? []).length === 0 && !ticketUsersQuery.loading ? (
                    <EmptyState title={t('more.noUsers')} />
                  ) : null}
                  {(ticketUsersQuery.data?.getTicketUsers.users ?? []).map((item) => (
                    <Pressable
                      key={item._id}
                      onPress={() => setSelectedTicketUser(item)}
                      style={[styles.listRow, { borderColor: colors.border }]}
                    >
                      <View style={styles.menuText}>
                        <Text style={[styles.menuLabel, { color: colors.text }]}>{item.name ?? t('common.na')}</Text>
                        <Text style={[styles.menuHint, { color: colors.textMuted }]}>
                          {item.latestTicket?.title ?? t('more.noTickets')}
                        </Text>
                      </View>
                      <Text style={[styles.chevron, { color: colors.textMuted }]}>{isRtl ? '‹' : '›'}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              )
            ) : null}

            {panel === 'notify' ? (
              <ScrollView style={styles.sheetBody} keyboardShouldPersistTaps="handled">
                <TextField
                  label={t('more.notificationTitle')}
                  value={title}
                  onChangeText={setTitle}
                  placeholder={t('more.notificationTitle')}
                />
                <TextField
                  label={t('more.notificationBody')}
                  value={body}
                  onChangeText={setBody}
                  placeholder={t('more.notificationBody')}
                  multiline
                  numberOfLines={4}
                  style={styles.textArea}
                />
                <Button
                  label={t('more.send')}
                  onPress={send}
                  loading={sending}
                  disabled={!body.trim()}
                />
              </ScrollView>
            ) : null}
          </View>
        </View>
      </Modal>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 32, gap: 12 },
  title: { fontSize: 24, fontWeight: '800' },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  avatar: { width: 52, height: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 20, fontWeight: '800' },
  profileText: { flex: 1, gap: 3 },
  profileName: { fontSize: 16, fontWeight: '700' },
  group: { paddingVertical: 4, paddingHorizontal: 0, gap: 0 },
  menuRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 13,
    paddingHorizontal: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  menuText: { flex: 1, gap: 2 },
  menuLabel: { fontSize: 14, fontWeight: '600' },
  menuHint: { fontSize: 11 },
  chevron: { fontSize: 20 },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 14,
    gap: 10,
  },
  segment: { flexDirection: 'row', gap: 6 },
  segmentItem: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  segmentLabel: { fontSize: 11, fontWeight: '700' },
  version: { textAlign: 'center', fontSize: 11, marginTop: 4 },
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 18,
    maxHeight: '82%',
    gap: 10,
  },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 18, fontWeight: '800' },
  close: { fontSize: 14, fontWeight: '700' },
  sheetBody: { maxHeight: 520 },
  listRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 10,
  },
  backLink: { paddingVertical: 6 },
  textArea: { minHeight: 96, textAlignVertical: 'top' },
});

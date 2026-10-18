
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from 'react'
import type { Session } from '@supabase/supabase-js'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  Bell,
  BookOpen,
  CalendarDays,
  Check,
  CheckCheck,
  CircleUserRound,
  Clock3,
  Flame,
  GraduationCap,
  Home,
  Leaf,
  LogOut,
  Menu,
  MessageCircle,
  MoreHorizontal,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Search,
  Send,
  Settings,
  ShieldCheck,
  Sparkles,
  Trash2,
  Target,
  Trophy,
  UserMinus,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { supabase } from './lib/supabaseClient'
import AuthPage from './auth'
import StudyGroups from './StudyGroups'
import Leaderboard from './Leaderboard'
import ProfilePage from './Profile'
import './App.css'
import './Theme.css'
import './Profile.css'

type Page =
  | 'Dashboard'
  | 'Focus Timer'
  | 'Friends'
  | 'Chat'
  | 'Leaderboard'
  | 'Study Groups'
  | 'Profile'

type FriendTab = 'friends' | 'requests' | 'discover'
type TimerMode = 'focus' | 'break'

type Profile = {
  id: string
  username: string
  display_name: string
  created_at?: string
  do_not_disturb?: boolean
  avatar_url?: string | null
}

type FriendRequest = {
  id: string
  sender_id: string
  receiver_id: string
  status: 'pending' | 'accepted' | 'declined'
  created_at: string
}

type Friend = {
  id: string
  name: string
  username: string
  initials: string
  color: string
  online: boolean
  doNotDisturb: boolean
  focusMinutes: number
  streak: number
  status: string
  avatar_url: string | null
}

type ChatMessage = {
  id: string
  sender_id: string
  receiver_id: string
  content: string
  created_at: string
  read_at?: string | null
}

type FocusSession = {
  id: string
  user_id: string
  duration_minutes: number
  completed_at: string
  subject?: string | null
  description?: string | null
}

const avatarColors = [
  'avatar-green',
  'avatar-purple',
  'avatar-blue',
  'avatar-orange',
]

const navigation: { label: Page; icon: ReactNode }[] = [
  { label: 'Dashboard', icon: <Home size={18} /> },
  { label: 'Focus Timer', icon: <Clock3 size={18} /> },
  { label: 'Friends', icon: <Users size={18} /> },
  { label: 'Chat', icon: <MessageCircle size={18} /> },
  { label: 'Leaderboard', icon: <Trophy size={18} /> },
  { label: 'Study Groups', icon: <GraduationCap size={18} /> },
  { label: 'Profile', icon: <CircleUserRound size={18} /> },
]

function initials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join('') || 'S'
  )
}

function formatDuration(totalSeconds: number) {
  const minutes = Math.floor(Math.max(0, totalSeconds) / 60)
  const seconds = Math.max(0, totalSeconds) % 60

  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`
}

function formatMessageTime(date: string) {
  return new Date(date).toLocaleTimeString([], {
    hour: 'numeric',
    minute: '2-digit',
  })
}

function formatDate(date: string) {
  return new Date(date).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message

  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error
  ) {
    return String(error.message)
  }

  return 'Something went wrong. Please try again.'
}

function App() {
  const [session, setSession] = useState<Session | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [currentPage, setCurrentPage] = useState<Page>('Dashboard')
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const [profile, setProfile] = useState<Profile | null>(null)
  const [profiles, setProfiles] = useState<Profile[]>([])
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([])
  const [friends, setFriends] = useState<Friend[]>([])
  const [discoverUsers, setDiscoverUsers] = useState<Friend[]>([])
  const [friendTab, setFriendTab] = useState<FriendTab>('friends')
  const [friendSearch, setFriendSearch] = useState('')
  const [pageSearch, setPageSearch] = useState('')
  const [onlineUserIds, setOnlineUserIds] = useState<string[]>([])

  const [doNotDisturb, setDoNotDisturb] = useState(false)
  const [dndLoading, setDndLoading] = useState(false)

  const [activeChatId, setActiveChatId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [messageDraft, setMessageDraft] = useState('')
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [messageSending, setMessageSending] = useState(false)
  const [chatActionLoading, setChatActionLoading] = useState(false)
  const [chatError, setChatError] = useState('')
  const [chatSearch, setChatSearch] = useState('')
  const [unreadCounts, setUnreadCounts] = useState<Record<string, number>>({})
  const [browserNotificationsEnabled, setBrowserNotificationsEnabled] =
    useState(
      typeof window !== 'undefined' &&
        'Notification' in window &&
        Notification.permission === 'granted',
    )

  const [completedSessions, setCompletedSessions] = useState<FocusSession[]>([])
  const [totalFocusSeconds, setTotalFocusSeconds] = useState(0)

  const [timerMode, setTimerMode] = useState<TimerMode>('focus')
  const [focusMinutes, setFocusMinutes] = useState(25)
  const [breakMinutes, setBreakMinutes] = useState(5)
  const [timerSeconds, setTimerSeconds] = useState(1500)
  const [timerRunning, setTimerRunning] = useState(false)
  const [autoStartBreak, setAutoStartBreak] = useState(false)
  const [timerNotice, setTimerNotice] = useState('Ready when you are. Let’s focus!')
  const [sessionCompletionPending, setSessionCompletionPending] = useState(false)
  const [pendingSessionMinutes, setPendingSessionMinutes] = useState(25)
  const [sessionSubject, setSessionSubject] = useState('')
  const [sessionDescription, setSessionDescription] = useState('')
  const [savingFocusSession, setSavingFocusSession] = useState(false)
  const [focusSessionError, setFocusSessionError] = useState('')

  const [friendLoading, setFriendLoading] = useState(false)
  const [friendError, setFriendError] = useState('')
  const [globalError, setGlobalError] = useState('')

  const userId = session?.user.id ?? null

  const displayName =
    profile?.display_name ||
    session?.user.user_metadata?.display_name ||
    session?.user.user_metadata?.full_name ||
    session?.user.email?.split('@')[0] ||
    'Student'

  const userInitials = initials(displayName)
  const activeFriend = friends.find((friend) => friend.id === activeChatId) ?? null

  const unreadTotal = Object.values(unreadCounts).reduce(
    (total, count) => total + count,
    0,
  )

  const incomingRequests = friendRequests.filter(
    (request) =>
      request.receiver_id === userId && request.status === 'pending',
  )

  const outgoingRequests = friendRequests.filter(
    (request) =>
      request.sender_id === userId && request.status === 'pending',
  )

  const todayKey = new Date().toDateString()

  const todaySessions = completedSessions.filter(
    (item) => new Date(item.completed_at).toDateString() === todayKey,
  )

  const todayMinutes = todaySessions.reduce(
    (total, item) => total + item.duration_minutes,
    0,
  )

  const totalFocusMinutes = Math.floor(totalFocusSeconds / 60)
  const focusGoalMinutes = 120
  const focusProgress = Math.min(
    100,
    Math.round((todayMinutes / focusGoalMinutes) * 100),
  )

  const todayLabel = new Date().toLocaleDateString([], {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  })

  // FOCENTRA uses its standard dark appearance only.
  useEffect(() => {
    document.documentElement.dataset.theme = 'dark'
    window.localStorage.removeItem('focentra-theme')
  }, [])

  // Authentication
  useEffect(() => {
    let mounted = true

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return

      if (error) setGlobalError(error.message)

      setSession(data.session)
      setAuthLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return

      setSession(nextSession)
      setAuthLoading(false)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  // Load the signed-in user's profile and saved DND status.
  useEffect(() => {
    if (!userId) {
      setProfile(null)
      setDoNotDisturb(false)
      setProfiles([])
      setFriendRequests([])
      setFriends([])
      setDiscoverUsers([])
      setCompletedSessions([])
      setTotalFocusSeconds(0)
      setMessages([])
      setActiveChatId(null)
      setOnlineUserIds([])
      setUnreadCounts({})
      return
    }

    let cancelled = false

    async function loadProfile() {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, username, display_name, created_at, do_not_disturb, avatar_url')
        .eq('id', userId!)
        .maybeSingle()

      if (cancelled) return

      if (error) {
        setGlobalError(`Could not load your profile: ${error.message}`)
        return
      }

      const loadedProfile = (data as Profile | null) ?? null
      setProfile(loadedProfile)
      setDoNotDisturb(loadedProfile?.do_not_disturb ?? false)
    }

    void loadProfile()

    return () => {
      cancelled = true
    }
  }, [userId])

  // Toggle DND and save the setting in Supabase.
  async function toggleDoNotDisturb() {
    if (!userId || dndLoading) return

    const nextValue = !doNotDisturb

    setDndLoading(true)
    setGlobalError('')

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ do_not_disturb: nextValue })
        .eq('id', userId)

      if (error) throw error

      setDoNotDisturb(nextValue)

      setProfile((previous) =>
        previous
          ? { ...previous, do_not_disturb: nextValue }
          : previous,
      )

      await loadFriends()
    } catch (error) {
      setGlobalError(
        `Could not update your status: ${getErrorMessage(error)}`,
      )
    } finally {
      setDndLoading(false)
    }
  }

  // Load friends, profiles, and requests.
  const loadFriends = useCallback(async () => {
    if (!userId) return

    setFriendLoading(true)
    setFriendError('')

    try {
      const [profileResult, requestResult] = await Promise.all([
        supabase
          .from('profiles')
          .select('id, username, display_name, created_at, do_not_disturb, avatar_url')
          .order('display_name'),
        supabase
          .from('friend_requests')
          .select('id, sender_id, receiver_id, status, created_at')
          .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
      ])

      if (profileResult.error) throw profileResult.error
      if (requestResult.error) throw requestResult.error

      const allProfiles = (profileResult.data ?? []) as Profile[]
      const allRequests = (requestResult.data ?? []) as FriendRequest[]

      setProfiles(allProfiles)
      setFriendRequests(allRequests)

      const profileById = new Map(allProfiles.map((item) => [item.id, item]))
      const acceptedIds = new Set<string>()
      const pendingIds = new Set<string>()

      for (const request of allRequests) {
        const otherId =
          request.sender_id === userId
            ? request.receiver_id
            : request.sender_id

        if (request.status === 'accepted') acceptedIds.add(otherId)
        if (request.status === 'pending') pendingIds.add(otherId)
      }

      const nextFriends: Friend[] = [...acceptedIds]
        .map((id, index) => {
          const item = profileById.get(id)
          if (!item) return null

          const isDnd = item.do_not_disturb ?? false

          return {
            id: item.id,
            name: item.display_name || item.username,
            username: item.username,
            avatar_url: item.avatar_url ?? null,
            initials: initials(item.display_name || item.username),
            color: avatarColors[index % avatarColors.length],
            online: onlineUserIds.includes(item.id),
            doNotDisturb: isDnd,
            focusMinutes: 0,
            streak: 0,
            status: isDnd ? 'Do Not Disturb' : 'Ready to study',
          }
        })
        .filter((item): item is Friend => item !== null)
        .sort((a, b) => a.name.localeCompare(b.name))

      const nextDiscover: Friend[] = allProfiles
        .filter(
          (item) =>
            item.id !== userId &&
            !acceptedIds.has(item.id) &&
            !pendingIds.has(item.id),
        )
        .map((item, index) => ({
          id: item.id,
          name: item.display_name || item.username,
          username: item.username,
          avatar_url: item.avatar_url ?? null,
          initials: initials(item.display_name || item.username),
          color: avatarColors[index % avatarColors.length],
          online: onlineUserIds.includes(item.id),
          doNotDisturb: item.do_not_disturb ?? false,
          focusMinutes: 0,
          streak: 0,
          status: item.do_not_disturb
            ? 'Do Not Disturb'
            : 'Student on FOCENTRA',
        }))
        .sort((a, b) => a.name.localeCompare(b.name))

      setFriends(nextFriends)
      setDiscoverUsers(nextDiscover)

      setActiveChatId((previous) => {
        if (previous && nextFriends.some((friend) => friend.id === previous)) {
          return previous
        }
        return null
      })
    } catch (error) {
      setFriendError(getErrorMessage(error))
    } finally {
      setFriendLoading(false)
    }
  }, [userId, onlineUserIds])

  useEffect(() => {
    if (userId) void loadFriends()
  }, [userId, loadFriends])

  // Refresh friend statuses when another user updates their profile.
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`focentra-profile-updates-${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'profiles',
        },
        () => {
          void loadFriends()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, loadFriends])

  // Realtime friend requests.
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`focentra-friend-requests-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'friend_requests',
        },
        () => void loadFriends(),
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, loadFriends])

  // Online presence.
  useEffect(() => {
    if (!userId) return

    const channel = supabase.channel('focentra-online-users', {
      config: { presence: { key: userId } },
    })

    channel
      .on('presence', { event: 'sync' }, () => {
        setOnlineUserIds(Object.keys(channel.presenceState()))
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            user_id: userId,
            display_name: displayName,
            online_at: new Date().toISOString(),
          })
        }
      })

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [userId, displayName])

  useEffect(() => {
    setFriends((previous) =>
      previous.map((friend) => ({
        ...friend,
        online: onlineUserIds.includes(friend.id),
      })),
    )

    setDiscoverUsers((previous) =>
      previous.map((friend) => ({
        ...friend,
        online: onlineUserIds.includes(friend.id),
      })),
    )
  }, [onlineUserIds])

  // Unread messages are counted per sender.
  const loadUnreadCounts = useCallback(async () => {
    if (!userId) return

    const { data, error } = await supabase
      .from('messages')
      .select('sender_id')
      .eq('receiver_id', userId)
      .is('read_at', null)

    if (error) {
      setGlobalError(`Could not load unread messages: ${error.message}`)
      return
    }

    const counts: Record<string, number> = {}

    for (const message of data ?? []) {
      counts[message.sender_id] = (counts[message.sender_id] ?? 0) + 1
    }

    setUnreadCounts(counts)
  }, [userId])

  useEffect(() => {
    if (userId) void loadUnreadCounts()
  }, [userId, loadUnreadCounts])

  // Persistent focus sessions.
  const loadFocusSessions = useCallback(async () => {
    if (!userId) return

    const { data, error } = await supabase
      .from('focus_sessions')
      .select('id, user_id, duration_minutes, completed_at, subject, description')
      .eq('user_id', userId)
      .order('completed_at', { ascending: false })

    if (error) {
      setGlobalError(`Could not load focus history: ${error.message}`)
      return
    }

    const sessions = (data ?? []) as FocusSession[]
    setCompletedSessions(sessions)
    setTotalFocusSeconds(
      sessions.reduce(
        (total, item) => total + item.duration_minutes * 60,
        0,
      ),
    )
  }, [userId])

  useEffect(() => {
    if (userId) void loadFocusSessions()
  }, [userId, loadFocusSessions])

  // Timer countdown. A completed focus timer must be described and saved before it earns credit.
  useEffect(() => {
    if (!timerRunning) return

    const interval = window.setInterval(() => {
      setTimerSeconds((remaining) => Math.max(0, remaining - 1))
    }, 1000)

    return () => window.clearInterval(interval)
  }, [timerRunning])

  useEffect(() => {
    if (!timerRunning || timerSeconds !== 0) return

    setTimerRunning(false)

    if (timerMode === 'focus') {
      setPendingSessionMinutes(focusMinutes)
      setSessionSubject('')
      setSessionDescription('')
      setFocusSessionError('')
      setSessionCompletionPending(true)
      setTimerNotice('Focus session complete. Add the details to save your study session.')
      return
    }

    setTimerNotice('Break complete. Ready for another focus session?')
    if (autoStartBreak) {
      setTimerMode('focus')
      setTimerSeconds(focusMinutes * 60)
      setTimerRunning(true)
    }
  }, [timerRunning, timerSeconds, timerMode, focusMinutes, autoStartBreak])

  async function saveCompletedFocusSession(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!userId || savingFocusSession) return

    const subject = sessionSubject.trim()
    const description = sessionDescription.trim()
    if (subject.length < 2) {
      setFocusSessionError('Enter the subject you studied (at least 2 characters).')
      return
    }
    if (description.length < 3) {
      setFocusSessionError('Add a short description of what you studied.')
      return
    }

    setSavingFocusSession(true)
    setFocusSessionError('')
    const { error } = await supabase.from('focus_sessions').insert({
      user_id: userId,
      duration_minutes: pendingSessionMinutes,
      subject,
      description,
    })

    if (error) {
      setFocusSessionError(`Your session could not be saved: ${error.message}. Make sure you have run goals-schema.sql in Supabase.`)
      setSavingFocusSession(false)
      return
    }

    setSessionCompletionPending(false)
    setTimerNotice(`Saved ${pendingSessionMinutes} minutes of ${subject}. Great work!`)
    await loadFocusSessions()
    setSavingFocusSession(false)

    if (autoStartBreak) {
      setTimerMode('break')
      setTimerSeconds(breakMinutes * 60)
      setTimerRunning(true)
      setTimerNotice('Study session saved. Take a short break!')
    }
  }

  // Mark incoming messages in the active conversation as read.
  const markConversationRead = useCallback(
    async (friendId: string) => {
      if (!userId) return

      const { error } = await supabase
        .from('messages')
        .update({ read_at: new Date().toISOString() })
        .eq('sender_id', friendId)
        .eq('receiver_id', userId)
        .is('read_at', null)

      if (error) {
        setChatError(`Could not mark messages as read: ${error.message}`)
        return
      }

      setUnreadCounts((previous) => {
        const next = { ...previous }
        delete next[friendId]
        return next
      })
    },
    [userId],
  )

  // Load the active conversation.
  const loadMessages = useCallback(async () => {
    if (!userId || !activeChatId) {
      setMessages([])
      return
    }

    setMessagesLoading(true)
    setChatError('')

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, sender_id, receiver_id, content, created_at, read_at')
        .or(
          `and(sender_id.eq.${userId},receiver_id.eq.${activeChatId}),and(sender_id.eq.${activeChatId},receiver_id.eq.${userId})`,
        )
        .order('created_at', { ascending: true })

      if (error) throw error

      setMessages((data ?? []) as ChatMessage[])
      await markConversationRead(activeChatId)
    } catch (error) {
      setChatError(getErrorMessage(error))
    } finally {
      setMessagesLoading(false)
    }
  }, [userId, activeChatId, markConversationRead])

  useEffect(() => {
    void loadMessages()
  }, [loadMessages])

  // Realtime messages. DND disables browser notifications, not incoming chat.
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`focentra-messages-${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'messages',
        },
        (payload) => {
          if (payload.eventType === 'DELETE') {
            void loadMessages()
            void loadUnreadCounts()
            return
          }

          const message = payload.new as ChatMessage

          if (
            message.sender_id !== userId &&
            message.receiver_id !== userId
          ) {
            return
          }

          if (payload.eventType === 'UPDATE') {
            setMessages((previous) =>
              previous.map((item) =>
                item.id === message.id ? message : item,
              ),
            )
            void loadUnreadCounts()
            return
          }

          if (payload.eventType !== 'INSERT') return

          const incoming = message.receiver_id === userId

          if (incoming) {
            const conversationOpen =
              currentPage === 'Chat' &&
              activeChatId === message.sender_id

            if (conversationOpen) {
              setMessages((previous) => {
                if (previous.some((item) => item.id === message.id)) {
                  return previous
                }
                return [...previous, message].sort(
                  (a, b) =>
                    new Date(a.created_at).getTime() -
                    new Date(b.created_at).getTime(),
                )
              })

              void markConversationRead(message.sender_id)
            } else {
              setUnreadCounts((previous) => ({
                ...previous,
                [message.sender_id]:
                  (previous[message.sender_id] ?? 0) + 1,
              }))

              const sender = friends.find(
                (friend) => friend.id === message.sender_id,
              )

              if (
                !doNotDisturb &&
                typeof window !== 'undefined' &&
                'Notification' in window &&
                Notification.permission === 'granted'
              ) {
                try {
                  new Notification(
                    `New message from ${sender?.name ?? 'a friend'}`,
                    {
                      body: message.content,
                      tag: `focentra-message-${message.id}`,
                    },
                  )
                } catch {
                  // In-app unread badges remain available if browser
                  // notifications are unavailable.
                }
              }
            }
          }

          if (
            activeChatId &&
            (
              (message.sender_id === activeChatId &&
                message.receiver_id === userId) ||
              (message.sender_id === userId &&
                message.receiver_id === activeChatId)
            )
          ) {
            setMessages((previous) => {
              if (previous.some((item) => item.id === message.id)) {
                return previous
              }
              return [...previous, message].sort(
                (a, b) =>
                  new Date(a.created_at).getTime() -
                  new Date(b.created_at).getTime(),
              )
            })
          }

          void loadUnreadCounts()
        },
      )
      .subscribe()

    return () => {
      void supabase.removeChannel(channel)
    }
  }, [
    userId,
    activeChatId,
    currentPage,
    friends,
    doNotDisturb,
    loadMessages,
    loadUnreadCounts,
    markConversationRead,
  ])

  async function enableBrowserNotifications() {
    if (!('Notification' in window)) {
      setChatError('This browser does not support browser notifications.')
      return
    }

    try {
      const permission = await Notification.requestPermission()
      const enabled = permission === 'granted'

      setBrowserNotificationsEnabled(enabled)

      if (!enabled) {
        setChatError(
          'Notifications are not enabled. You can still see unread badges inside FOCENTRA.',
        )
      } else {
        setChatError('')
      }
    } catch (error) {
      setChatError(getErrorMessage(error))
    }
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()

    if (error) {
      setGlobalError(error.message)
    } else {
      setCurrentPage('Dashboard')
      setGlobalError('')
    }
  }

  function navigate(page: Page) {
    setCurrentPage(page)
    setMobileSidebarOpen(false)
    setGlobalError('')
  }

  async function sendFriendRequest(friendId: string) {
    if (!userId) return

    setFriendError('')

    const { error } = await supabase.from('friend_requests').insert({
      sender_id: userId,
      receiver_id: friendId,
      status: 'pending',
    })

    if (error) {
      setFriendError(
        error.code === '23505'
          ? 'A request already exists between these accounts.'
          : error.message,
      )
      return
    }

    await loadFriends()
  }

  async function respondToRequest(
    requestId: string,
    status: 'accepted' | 'declined',
  ) {
    if (!userId) return

    setFriendError('')

    const { error } = await supabase
      .from('friend_requests')
      .update({ status })
      .eq('id', requestId)
      .eq('receiver_id', userId)
      .eq('status', 'pending')

    if (error) {
      setFriendError(error.message)
      return
    }

    await loadFriends()
  }

  async function removeFriend(friend: Friend) {
    if (!userId) return

    const confirmed = window.confirm(
      `Remove ${friend.name} from your friends? Your existing chat messages will not be deleted.`,
    )

    if (!confirmed) return

    setFriendError('')

    const relationship = friendRequests.find(
      (request) =>
        request.status === 'accepted' &&
        (
          (request.sender_id === userId &&
            request.receiver_id === friend.id) ||
          (request.sender_id === friend.id &&
            request.receiver_id === userId)
        ),
    )

    if (!relationship) {
      setFriendError(
        'Could not find the accepted friendship record. Refresh your friends list and try again.',
      )
      return
    }

    const { error } = await supabase
      .from('friend_requests')
      .delete()
      .eq('id', relationship.id)
      .eq('status', 'accepted')

    if (error) {
      setFriendError(`Could not remove friend: ${error.message}`)
      return
    }

    if (activeChatId === friend.id) {
      setActiveChatId(null)
      setMessages([])
    }

    await loadFriends()
  }

  async function clearChat() {
    if (!userId || !activeChatId || chatActionLoading) return

    const friend = friends.find((item) => item.id === activeChatId)
    if (!friend) return

    const confirmed = window.confirm(
      `Clear the entire conversation with ${friend.name}? This permanently deletes the messages for both participants.`,
    )

    if (!confirmed) return

    setChatActionLoading(true)
    setChatError('')

    try {
      const { error } = await supabase
        .from('messages')
        .delete()
        .or(
          `and(sender_id.eq.${userId},receiver_id.eq.${activeChatId}),and(sender_id.eq.${activeChatId},receiver_id.eq.${userId})`,
        )

      if (error) throw error

      setMessages([])
      setUnreadCounts((previous) => {
        const next = { ...previous }
        delete next[activeChatId]
        return next
      })
    } catch (error) {
      setChatError(`Could not clear the conversation: ${getErrorMessage(error)}`)
    } finally {
      setChatActionLoading(false)
    }
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!userId || !activeChatId || messageSending) return

    const content = messageDraft.trim()
    if (!content) return

    if (content.length > 2000) {
      setChatError('Messages must be 2,000 characters or fewer.')
      return
    }

    setMessageSending(true)
    setChatError('')

    try {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          sender_id: userId,
          receiver_id: activeChatId,
          content,
        })
        .select(
          'id, sender_id, receiver_id, content, created_at, read_at',
        )
        .single()

      if (error) throw error

      const savedMessage = data as ChatMessage

      setMessages((previous) => {
        if (previous.some((item) => item.id === savedMessage.id)) {
          return previous
        }
        return [...previous, savedMessage]
      })

      setMessageDraft('')
    } catch (error) {
      setChatError(getErrorMessage(error))
    } finally {
      setMessageSending(false)
    }
  }

  function openChat(friendId: string) {
    setActiveChatId(friendId)
    setChatError('')
    setMessageDraft('')
    navigate('Chat')
  }

  function selectTimerMode(mode: TimerMode) {
    setTimerRunning(false)
    setTimerMode(mode)
    setTimerSeconds((mode === 'focus' ? focusMinutes : breakMinutes) * 60)
    setTimerNotice(
      mode === 'focus'
        ? 'Ready when you are. Let’s focus!'
        : 'Take a moment to recharge.',
    )
  }

  function resetTimer() {
    setTimerRunning(false)
    setTimerSeconds((timerMode === 'focus' ? focusMinutes : breakMinutes) * 60)
    setTimerNotice('Timer reset. Start whenever you are ready.')
  }

  function changePageSearch(value: string) {
    setPageSearch(value)

    if (value.trim()) {
      setCurrentPage('Friends')
      setFriendTab('discover')
      setFriendSearch(value)
    }
  }

  function renderPageHeading(
    eyebrow: string,
    title: ReactNode,
    description: string,
  ) {
    return (
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            <span className="eyebrow-line" />
            {eyebrow}
          </div>
          <h1>{title}</h1>
          <p>{description}</p>
        </div>
        <div className="date-chip">
          <CalendarDays size={15} />
          {todayLabel}
        </div>
      </div>
    )
  }

  function renderDashboard() {
    return (
      <div className="page-content">
        {renderPageHeading(
          'YOUR STUDY SPACE',
          <>Welcome back, <span>{displayName.split(' ')[0]}.</span></>,
          'A little progress every day adds up. Let’s make today count.',
        )}

        <section className="hero-banner">
          <div className="hero-decoration decoration-one" />
          <div className="hero-decoration decoration-two" />

          <div className="hero-content">
            <div className="hero-tag"><span />YOUR NEXT FOCUS SESSION</div>
            <h2>Small steps.<br /><span>Big progress.</span></h2>
            <p>Create space for focused learning, build better habits, and celebrate the progress you make along the way.</p>
            <button className="hero-button" onClick={() => navigate('Focus Timer')}>
              <Play size={15} fill="currentColor" /> Start focusing <ArrowRight size={15} />
            </button>
          </div>

          <div className="hero-art">
            <div className="hero-orbit" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-glow" />
            <div className="hero-center-icon"><BookOpen size={52} /></div>
            <div className="hero-leaf leaf-one"><Leaf size={30} /></div>
            <div className="hero-leaf leaf-two"><Sparkles size={28} /></div>
            <div className="floating-card floating-card-top">
              <div className="floating-icon"><Flame size={17} /></div>
              <div><strong>Keep going!</strong><small>Every minute matters</small></div>
            </div>
            <div className="floating-card floating-card-bottom">
              <div className="floating-check"><Check size={17} /></div>
              <div><strong>One step at a time</strong><small>Your journey, your pace</small></div>
            </div>
          </div>
        </section>

        <div className="section-title-row">
          <div><h2>Your progress</h2><p>A snapshot of your study activity.</p></div>
          <div className="overview-chip"><span />Updated from your sessions</div>
        </div>

        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-top">
              <div className="stat-icon green-icon"><Clock3 size={20} /></div>
              <span className="stat-caption">TOTAL FOCUS</span>
            </div>
            <div className="stat-number">{Math.floor(totalFocusMinutes / 60)}<span> hr </span>{totalFocusMinutes % 60}<span> min</span></div>
            <p>Your recorded focus time.</p>
            <div className="stat-bottom"><div className="mini-progress"><span style={{ width: `${Math.min(100, totalFocusMinutes / 6)}%` }} /></div><small>Every session counts</small></div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <div className="stat-icon orange-icon"><Flame size={20} /></div>
              <span className="stat-caption">TODAY'S FOCUS</span>
            </div>
            <div className="stat-number">{todayMinutes}<span> min</span></div>
            <p>Time focused today.</p>
            <div className="stat-bottom"><div className="mini-progress"><span style={{ width: `${focusProgress}%` }} /></div><small>{todayMinutes} of {focusGoalMinutes} minutes</small></div>
          </div>

          <div className="stat-card">
            <div className="stat-top">
              <div className="stat-icon purple-icon"><Target size={20} /></div>
              <span className="stat-caption">SESSIONS</span>
            </div>
            <div className="stat-number">{completedSessions.length}</div>
            <p>Completed focus sessions.</p>
            <div className="stat-bottom"><div className="mini-progress"><span style={{ width: `${Math.min(100, completedSessions.length * 5)}%` }} /></div><small>Your progress is saved</small></div>
          </div>
        </div>

        <div className="section-title-row activity-heading">
          <div><h2>What's next?</h2><p>Choose your next step.</p></div>
        </div>

        <div className="bottom-grid">
          <div className="next-step-card">
            <div className="next-step-icon"><Zap size={21} /></div>
            <div className="next-step-copy">
              <span className="card-kicker">READY TO FOCUS?</span>
              <h3>Give your next task your full attention.</h3>
              <p>Set a timer and work at your own pace.</p>
            </div>
            <button className="round-arrow" aria-label="Open focus timer" onClick={() => navigate('Focus Timer')}><ArrowRight size={17} /></button>
          </div>
          <div className="quote-card">
            <span className="quote-mark">“</span>
            <blockquote>Success is the sum of small efforts, repeated day in and day out.</blockquote>
            <span>A reminder to keep moving forward</span>
          </div>
        </div>
      </div>
    )
  }

  function renderTimer() {
    const configuredSeconds = (timerMode === 'focus' ? focusMinutes : breakMinutes) * 60
    const timerProgress = configuredSeconds > 0
      ? ((configuredSeconds - timerSeconds) / configuredSeconds) * 100
      : 0

    return (
      <div className="page-content timer-page">
        {renderPageHeading('FOCUS MODE', <>Find your <span>flow.</span></>, 'Set aside distractions and give one task your attention.')}

        <div className="timer-layout">
          <section className="timer-card">
            <div className="timer-mode-tabs">
              <button className={`timer-tab ${timerMode === 'focus' ? 'timer-tab-active' : ''}`} onClick={() => selectTimerMode('focus')}><Target size={16} />Focus</button>
              <button className={`timer-tab ${timerMode === 'break' ? 'timer-tab-active' : ''}`} onClick={() => selectTimerMode('break')}><Leaf size={16} />Break</button>
            </div>

            <div className={`timer-ring ${timerMode === 'break' ? 'timer-ring-break' : ''}`}>
              <svg className="timer-svg" viewBox="0 0 200 200">
                <circle className="timer-track" cx="100" cy="100" r="88" />
                <circle className="timer-progress" cx="100" cy="100" r="88" strokeDasharray={2 * Math.PI * 88} strokeDashoffset={2 * Math.PI * 88 * (1 - timerProgress / 100)} />
              </svg>
              <div className="timer-time-content">
                <span className="timer-session-label">{timerMode === 'focus' ? 'FOCUS SESSION' : 'BREAK TIME'}</span>
                <div className="timer-digits">{formatDuration(timerSeconds)}</div>
                <span className="timer-subtitle">{timerRunning ? 'One thing at a time' : 'Ready when you are'}</span>
              </div>
            </div>

            <div className="timer-controls">
              <button className="timer-reset-button" onClick={resetTimer} aria-label="Reset timer"><RotateCcw size={19} /></button>
              <button className="timer-start-button" onClick={() => {
                if (timerSeconds <= 0) setTimerSeconds((timerMode === 'focus' ? focusMinutes : breakMinutes) * 60)
                setTimerRunning((previous) => !previous)
              }}>
                {timerRunning ? <><Pause size={17} />Pause timer</> : <><Play size={17} fill="currentColor" />Start timer</>}
              </button>
              <div className="timer-control-spacer" />
            </div>
            <p className="timer-encouragement"><Sparkles size={15} />{timerNotice}</p>
          </section>

          <div className="timer-settings-column">
            <section className="timer-settings-card">
              <div className="timer-card-heading">
                <div className="timer-settings-icon"><Settings size={20} /></div>
                <div><h2>Timer settings</h2><p>Make the timer work for you.</p></div>
              </div>

              {([
                { label: 'Focus duration', value: focusMinutes, max: 180, set: setFocusMinutes, mode: 'focus' as TimerMode },
                { label: 'Break duration', value: breakMinutes, max: 60, set: setBreakMinutes, mode: 'break' as TimerMode },
              ]).map((setting) => (
                <div className="duration-setting" key={setting.label}>
                  <div className="duration-setting-heading"><label>{setting.label}</label><span>{setting.value} min</span></div>
                  <input type="range" min="1" max={setting.max} value={setting.value} disabled={timerRunning} onChange={(event) => {
                    const value = Number(event.target.value)
                    setting.set(value)
                    if (timerMode === setting.mode) setTimerSeconds(value * 60)
                  }} />
                  <div className="duration-number-row">
                    <button disabled={timerRunning || setting.value <= 1} onClick={() => {
                      const value = Math.max(1, setting.value - 1)
                      setting.set(value)
                      if (timerMode === setting.mode) setTimerSeconds(value * 60)
                    }}>−</button>
                    <span>{setting.value} min</span>
                    <button disabled={timerRunning || setting.value >= setting.max} onClick={() => {
                      const value = Math.min(setting.max, setting.value + 1)
                      setting.set(value)
                      if (timerMode === setting.mode) setTimerSeconds(value * 60)
                    }}>+</button>
                  </div>
                </div>
              ))}

              <div className="auto-switch-row">
                <div><strong>Automatic next session</strong><p>Start the next period when the timer ends.</p></div>
                <button className={`toggle-switch ${autoStartBreak ? 'toggle-switch-on' : ''}`} role="switch" aria-checked={autoStartBreak} onClick={() => setAutoStartBreak((value) => !value)}><span /></button>
              </div>
              <button className="apply-timer-button" onClick={resetTimer}><Check size={16} />Apply timer settings</button>
            </section>

            <section className="timer-summary-card">
              <div className="summary-icon"><Trophy size={21} /></div>
              <div><span>YOUR PROGRESS</span><h3>{completedSessions.length} sessions completed</h3><p>{totalFocusMinutes} total minutes focused</p></div>
            </section>
          </div>
        </div>
      </div>
    )
  }

  function renderFriends() {
    const filteredFriends = friends.filter((friend) => {
      const query = friendSearch.toLowerCase()
      return friend.name.toLowerCase().includes(query) || friend.username.toLowerCase().includes(query)
    })

    const filteredDiscover = discoverUsers.filter((friend) => {
      const query = friendSearch.toLowerCase()
      return friend.name.toLowerCase().includes(query) || friend.username.toLowerCase().includes(query)
    })

    return (
      <div className="page-content friends-page">
        {renderPageHeading('YOUR STUDY COMMUNITY', <>Better together<span>.</span></>, 'Find friends, build your study circle, and encourage each other.')}

        <div className="friends-summary-grid">
          <div className="friends-summary-card"><div className="friends-summary-icon"><Users size={21} /></div><div><span>YOUR FRIENDS</span><strong>{friends.length}</strong><small>Connected students</small></div></div>
          <div className="friends-summary-card"><div className="friends-summary-icon friends-online-icon"><Activity size={21} /></div><div><span>ONLINE NOW</span><strong>{friends.filter((friend) => friend.online).length}</strong><small>Friends currently online</small></div></div>
          <div className="friends-summary-card"><div className="friends-summary-icon friends-request-icon"><Bell size={21} /></div><div><span>NEW REQUESTS</span><strong>{incomingRequests.length}</strong><small>Waiting for your response</small></div></div>
        </div>

        <div className="invite-banner">
          <div className="invite-banner-icon"><Sparkles size={25} /></div>
          <div className="invite-banner-copy"><span>STUDY COMMUNITY</span><h2>Make studying a shared journey.</h2><p>Connect with students and message your accepted friends.</p></div>
          <button className="invite-button" onClick={() => setFriendTab('discover')}><Users size={15} />Find students</button>
        </div>

        <section className="friends-directory">
          <div className="friends-directory-heading">
            <div><h2>Your network</h2><p>Manage your friends and invitations.</p></div>
            <div className="friends-search"><Search size={15} /><input value={friendSearch} onChange={(event) => setFriendSearch(event.target.value)} placeholder="Search students..." />{friendSearch && <button aria-label="Clear search" onClick={() => setFriendSearch('')}><X size={14} /></button>}</div>
          </div>

          <div className="friends-tabs">
            <button className={`friends-tab ${friendTab === 'friends' ? 'friends-tab-active' : ''}`} onClick={() => setFriendTab('friends')}><Users size={14} />Friends<span>{friends.length}</span></button>
            <button className={`friends-tab ${friendTab === 'requests' ? 'friends-tab-active' : ''}`} onClick={() => setFriendTab('requests')}>Requests<span>{incomingRequests.length}</span></button>
            <button className={`friends-tab ${friendTab === 'discover' ? 'friends-tab-active' : ''}`} onClick={() => setFriendTab('discover')}>Discover<span>{discoverUsers.length}</span></button>
          </div>

          {friendError && <div className="chat-page-error" role="alert">{friendError}</div>}

          {friendLoading ? <div className="friends-empty"><Activity size={24} /><strong>Loading your network...</strong></div> : (
            <div className="friend-list">
              {friendTab === 'friends' && (filteredFriends.length ? filteredFriends.map((friend) => (
                <div className="friend-row" key={friend.id}>
                  <div className="friend-avatar-wrap"><div className={`friend-avatar ${friend.color}`}>{friend.avatar_url ? <img src={friend.avatar_url} alt={`${friend.name} profile`} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', borderRadius: '50%' }} onError={(event) => { event.currentTarget.style.display = 'none'; event.currentTarget.parentElement!.textContent = friend.initials }} /> : friend.initials}</div><span className={`friend-presence ${friend.online ? 'presence-online' : 'presence-offline'}`} /></div>
                  <div className="friend-main-info"><strong>{friend.name}</strong><span>@{friend.username}</span><p className={friend.doNotDisturb ? 'dnd-status' : ''}>{friend.doNotDisturb ? <><span className="dnd-dot" />Do Not Disturb</> : <>{friend.online ? 'Online now' : 'Offline'} · {friend.status}</>}</p></div>
                  <button className="friend-chat-button" onClick={() => openChat(friend.id)}><MessageCircle size={14} />Message</button>
                  <button className="decline-request-button" title={`Remove ${friend.name}`} onClick={() => void removeFriend(friend)}><UserMinus size={14} />Remove</button>
                </div>
              )) : <div className="friends-empty"><Users size={27} /><strong>No friends found yet</strong><p>Discover students and send a friend request to connect.</p><button className="invite-button" onClick={() => setFriendTab('discover')}><Search size={14} />Discover students</button></div>)}

              {friendTab === 'requests' && (incomingRequests.length || outgoingRequests.length ? <>
                {incomingRequests.map((request) => {
                  const sender = profiles.find((item) => item.id === request.sender_id)
                  const name = sender?.display_name || sender?.username || 'Student'
                  return <div className="friend-row request-row" key={request.id}><div className="friend-avatar avatar-green">{sender?.avatar_url ? <img src={sender.avatar_url} alt={`${name} profile`} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', borderRadius: '50%' }} onError={(event) => { event.currentTarget.style.display = 'none'; event.currentTarget.parentElement!.textContent = initials(name) }} /> : initials(name)}</div><div className="friend-main-info"><strong>{name}</strong><span>@{sender?.username ?? 'student'}</span><p>Wants to connect with you</p></div><div className="request-actions"><button className="accept-request-button" onClick={() => void respondToRequest(request.id, 'accepted')}><Check size={14} />Accept</button><button className="decline-request-button" onClick={() => void respondToRequest(request.id, 'declined')}><X size={14} />Decline</button></div></div>
                })}
                {outgoingRequests.map((request) => {
                  const receiver = profiles.find((item) => item.id === request.receiver_id)
                  const name = receiver?.display_name || receiver?.username || 'Student'
                  return <div className="friend-row" key={request.id}><div className="friend-avatar avatar-blue">{receiver?.avatar_url ? <img src={receiver.avatar_url} alt={`${name} profile`} style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', borderRadius: '50%' }} onError={(event) => { event.currentTarget.style.display = 'none'; event.currentTarget.parentElement!.textContent = initials(name) }} /> : initials(name)}</div><div className="friend-main-info"><strong>{name}</strong><span>@{receiver?.username ?? 'student'}</span><p>Friend request sent · Waiting for response</p></div><button className="friend-chat-button request-sent-button" disabled><Clock3 size={14} />Pending</button></div>
                })}
              </> : <div className="friends-empty"><Bell size={27} /><strong>No pending requests</strong><p>New invitations will appear here.</p></div>)}

              {friendTab === 'discover' && (filteredDiscover.length ? filteredDiscover.map((friend) => {
                const alreadySent = outgoingRequests.some((request) => request.receiver_id === friend.id)
                return <div className="friend-row" key={friend.id}><div className="friend-avatar-wrap"><div className={`friend-avatar ${friend.color}`}>{friend.avatar_url ? <img src={friend.avatar_url} alt={`${friend.name} profile`} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', borderRadius: '50%' }} onError={(event) => { event.currentTarget.style.display = 'none'; event.currentTarget.parentElement!.textContent = friend.initials }} /> : friend.initials}</div><span className={`friend-presence ${friend.online ? 'presence-online' : 'presence-offline'}`} /></div><div className="friend-main-info"><strong>{friend.name}</strong><span>@{friend.username}</span><p className={friend.doNotDisturb ? 'dnd-status' : ''}>{friend.doNotDisturb ? <><span className="dnd-dot" />Do Not Disturb</> : <>{friend.online ? 'Online now' : 'Student on FOCENTRA'}</>}</p></div><button className={`friend-chat-button ${alreadySent ? 'request-sent-button' : ''}`} disabled={alreadySent} onClick={() => void sendFriendRequest(friend.id)}>{alreadySent ? <><Clock3 size={14} />Pending</> : <><Plus size={14} />Add friend</>}</button></div>
              }) : <div className="friends-empty"><Search size={27} /><strong>No students found</strong><p>Try a different search, or check back later.</p></div>)}
            </div>
          )}

          <div className="friends-demo-note"><ShieldCheck size={15} />Friends and requests are stored in your Supabase database.</div>
        </section>
      </div>
    )
  }

  function renderChat() {
    const filteredChatFriends = friends.filter((friend) => {
      const query = chatSearch.toLowerCase()
      return friend.name.toLowerCase().includes(query) || friend.username.toLowerCase().includes(query)
    })

    return (
      <div className="page-content chat-page">
        {renderPageHeading('YOUR CONVERSATIONS', <>Study <span>together.</span></>, 'Message your friends and keep each other motivated.')}

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button className="friend-chat-button" onClick={() => void enableBrowserNotifications()}>
            <Bell size={15} />
            {browserNotificationsEnabled ? 'Notifications enabled' : 'Enable notifications'}
          </button>
        </div>

        {chatError && <div className="chat-page-error" role="alert">{chatError}</div>}

        <div className="chat-page-layout">
          <aside className="chat-sidebar-list">
            <div className="chat-sidebar-heading"><h2>Messages</h2><p>{friends.length} connected {friends.length === 1 ? 'friend' : 'friends'}</p></div>
            <div className="chat-sidebar-search"><Search size={15} /><input value={chatSearch} onChange={(event) => setChatSearch(event.target.value)} placeholder="Find a conversation..." aria-label="Search conversations" /></div>

            <div className="chat-sidebar-items">
              {filteredChatFriends.length ? filteredChatFriends.map((friend) => (
                <button className={`chat-sidebar-friend ${activeChatId === friend.id ? 'chat-sidebar-active' : ''}`} key={friend.id} onClick={() => openChat(friend.id)}>
                  <div className="friend-avatar-wrap"><div className={`friend-avatar ${friend.color}`}>{friend.avatar_url ? <img src={friend.avatar_url} alt={`${friend.name} profile`} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', borderRadius: '50%' }} onError={(event) => { event.currentTarget.style.display = 'none'; event.currentTarget.parentElement!.textContent = friend.initials }} /> : friend.initials}</div><span className={`friend-presence ${friend.online ? 'presence-online' : 'presence-offline'}`} /></div>
                  <div className="chat-sidebar-friend-info">
                    <strong>{friend.name}</strong>
                    <span className={friend.doNotDisturb ? 'dnd-status' : ''}>
                      {friend.doNotDisturb ? (
                        <><i className="dnd-dot" />Do Not Disturb</>
                      ) : friend.online ? (
                        'Online now'
                      ) : (
                        `@${friend.username}`
                      )}
                    </span>
                  </div>
                  {(unreadCounts[friend.id] ?? 0) > 0 && <span className="unread-badge">{unreadCounts[friend.id]}</span>}
                </button>
              )) : <div className="chat-sidebar-empty">{friends.length ? 'No conversations match your search.' : 'Add friends first to start a conversation.'}<button className="invite-button" style={{ marginTop: 12 }} onClick={() => navigate('Friends')}><Users size={14} />Find friends</button></div>}
            </div>
          </aside>

          <main className="chat-page-main">
            {activeFriend ? (
              <section className="chat-window">
                <header className="chat-header">
                  <button className="chat-back-button" aria-label="Back to friends" onClick={() => navigate('Friends')}><ArrowLeft size={17} /></button>
                  <div className={`friend-avatar ${activeFriend.color}`}>{activeFriend.avatar_url ? <img src={activeFriend.avatar_url} alt={`${activeFriend.name} profile`} referrerPolicy="no-referrer" style={{ width: '100%', height: '100%', display: 'block', objectFit: 'cover', borderRadius: '50%' }} onError={(event) => { event.currentTarget.style.display = 'none'; event.currentTarget.parentElement!.textContent = activeFriend.initials }} /> : activeFriend.initials}</div>
                  <div className="chat-header-info">
                    <strong>{activeFriend.name}</strong>
                    {activeFriend.doNotDisturb ? (
                      <span className="dnd-status"><i className="dnd-dot" />Do Not Disturb</span>
                    ) : (
                      <span><i className={activeFriend.online ? 'online-dot' : 'offline-dot'} />{activeFriend.online ? 'Online now' : 'Offline'}</span>
                    )}
                  </div>
                  <button className="chat-more-button" aria-label="Refresh conversation" onClick={() => void loadMessages()}><MoreHorizontal size={19} /></button>
                  <button className="chat-more-button" title="Clear chat" aria-label="Clear chat" disabled={chatActionLoading} onClick={() => void clearChat()}><Trash2 size={17} /></button>
                  <button className="chat-more-button" title="Remove friend" aria-label="Remove friend" onClick={() => void removeFriend(activeFriend)}><UserMinus size={17} /></button>
                </header>

                <div className="chat-study-banner"><span><BookOpen size={17} /></span><div><strong>Your study space</strong><p>Conversations reset after 24 hours of inactivity.</p></div></div>

                <div className="chat-messages">
                  {messagesLoading ? <div className="chat-empty"><Activity size={23} /><p>Loading messages...</p></div> : messages.length === 0 ? <div className="chat-empty"><div className="chat-empty-icon"><MessageCircle size={23} /></div><strong>Say hello to {activeFriend.name}</strong><p>This conversation is empty. Send the first message to get started.</p></div> : messages.map((message, index) => {
                    const mine = message.sender_id === userId
                    const previousMessage = messages[index - 1]
                    const showDate = !previousMessage || new Date(previousMessage.created_at).toDateString() !== new Date(message.created_at).toDateString()

                    return <div key={message.id}>
                      {showDate && <div className="chat-date-divider">{formatDate(message.created_at)}</div>}
                      <div className={`chat-message-row ${mine ? 'chat-message-mine' : ''}`}>
                        {!mine && <div className={`chat-mini-avatar ${activeFriend.color}`}>{activeFriend.initials}</div>}
                        <div className="chat-message-content">
                          <div className={`chat-bubble ${mine ? 'chat-bubble-mine' : ''}`}>{message.content}</div>
                          <span className="chat-message-time">{formatMessageTime(message.created_at)}{mine && <> <CheckCheck size={12} style={{ display: 'inline', verticalAlign: 'middle' }} /></>}</span>
                        </div>
                      </div>
                    </div>
                  })}
                </div>

                <form className="chat-composer" onSubmit={sendMessage}>
                  <input value={messageDraft} onChange={(event) => setMessageDraft(event.target.value)} placeholder={`Message ${activeFriend.name}...`} maxLength={2000} aria-label="Write a message" disabled={messageSending} />
                  <button type="submit" aria-label="Send message" disabled={!messageDraft.trim() || messageSending}><Send size={17} /></button>
                </form>
                <p className="local-chat-note">Messages are saved to your FOCENTRA account. Conversations clear after 24 hours without a new message.</p>
              </section>
            ) : (
              <section className="chat-page-welcome">
                <div className="chat-page-welcome-inner">
                  <div className="chat-page-welcome-icon"><MessageCircle size={30} /></div>
                  <h2>Your conversations start here.</h2>
                  <p>Select a friend from the list to open your conversation. Unread messages appear beside their name.</p>
                  <div className="chat-page-status"><span className="online-dot" />Realtime messaging</div>
                  {!friends.length && <button className="hero-button" onClick={() => navigate('Friends')}><Users size={15} />Find study friends</button>}
                </div>
              </section>
            )}
          </main>
        </div>
      </div>
    )
  }


  if (authLoading) {
    return <div className="app-shell"><main className="main-panel"><div className="page-content"><div className="chat-page-loading">Loading FOCENTRA...</div></div></main></div>
  }

  if (!session) return <AuthPage />

  return (
    <div className="app-shell">
      {mobileSidebarOpen && <button className="mobile-overlay" aria-label="Close navigation" onClick={() => setMobileSidebarOpen(false)} />}

      <aside className={`sidebar ${mobileSidebarOpen ? 'sidebar-open' : ''}`}>
        <button className="brand" onClick={() => navigate('Dashboard')} aria-label="FOCENTRA home"><span className="brand-icon"><Leaf size={23} /></span><span className="brand-name">FOCENTRA</span></button>
        <div className="sidebar-label">WORKSPACE</div>

        <nav className="sidebar-nav">
          {navigation.map((item) => (
            <button key={item.label} className={`nav-item ${currentPage === item.label ? 'nav-active' : ''}`} onClick={() => navigate(item.label)}>
              {item.icon}<span>{item.label}</span>
              {item.label === 'Chat' && unreadTotal > 0 && <span className="unread-badge">{unreadTotal}</span>}
              {item.label === 'Friends' && incomingRequests.length > 0 && <span className="unread-badge">{incomingRequests.length}</span>}
              {currentPage === item.label && <span className="active-indicator" />}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <button className="sidebar-profile" onClick={() => navigate('Profile')} aria-label="Open profile">{profile?.avatar_url ? <img className="profile-avatar profile-avatar-image" src={profile.avatar_url} alt="" /> : <div className="profile-avatar">{userInitials}</div>}<div className="profile-info"><strong>{displayName}</strong><span>{session.user.email || 'Signed in'}</span></div><span className="profile-status" /></button>
          <button className="nav-item" style={{ marginTop: 10 }} onClick={() => void signOut()}><LogOut size={18} /><span>Sign out</span></button>
        </div>
      </aside>

      <main className="main-panel">
        <header className="topbar">
          <button className="mobile-menu-button" aria-label="Open navigation" onClick={() => setMobileSidebarOpen(true)}><Menu size={21} /></button>
          <div className="breadcrumb"><span>Workspace</span><ArrowRight size={13} /><strong>{currentPage}</strong></div>

          <div className="topbar-right">
            <div className="global-search-wrap">
              <div className="search-box"><Search size={15} /><input value={pageSearch} onChange={(event) => changePageSearch(event.target.value)} placeholder="Find students..." aria-label="Search students" />{pageSearch && <button className="clear-search" aria-label="Clear search" onClick={() => { setPageSearch(''); setFriendSearch('') }}><X size={14} /></button>}</div>
            </div>

            <button
              className={`dnd-toggle ${doNotDisturb ? 'dnd-toggle-active' : ''}`}
              onClick={() => void toggleDoNotDisturb()}
              disabled={dndLoading}
              aria-pressed={doNotDisturb}
              title={doNotDisturb ? 'Turn off Do Not Disturb' : 'Turn on Do Not Disturb'}
            >
              <span className={doNotDisturb ? 'dnd-dot' : 'available-dot'} />
              {dndLoading
                ? 'Updating...'
                : doNotDisturb
                  ? 'Do Not Disturb'
                  : 'Available'}
            </button>

            <button className="notification-button" aria-label="View notifications" title={`${unreadTotal} unread messages`} onClick={() => {
              if (unreadTotal > 0) {
                navigate('Chat')
              } else {
                setFriendTab('requests')
                navigate('Friends')
              }
            }}>
              <Bell size={17} />
              {(unreadTotal > 0 || incomingRequests.length > 0) && <span />}
            </button>
            <button className="topbar-avatar" aria-label="Open profile" title="Open profile" onClick={() => navigate('Profile')}>{profile?.avatar_url ? <img src={profile.avatar_url} alt="" /> : userInitials}</button>
          </div>
        </header>

        {globalError && <div className="chat-page-error" style={{ margin: '12px 24px 0' }} role="alert">{globalError}<button style={{ float: 'right', border: 0, background: 'transparent', color: 'inherit' }} aria-label="Dismiss error" onClick={() => setGlobalError('')}><X size={14} /></button></div>}

        {currentPage === 'Dashboard' && renderDashboard()}
        {currentPage === 'Focus Timer' && renderTimer()}
        {currentPage === 'Friends' && renderFriends()}
        {currentPage === 'Chat' && renderChat()}
        {currentPage === 'Study Groups' && userId && <StudyGroups userId={userId} currentProfile={profile} />}
        {currentPage === 'Leaderboard' && userId && (
          <Leaderboard userId={userId} onStartFocus={() => navigate('Focus Timer')} />
        )}
        {currentPage === 'Profile' && <ProfilePage session={session} profile={profile} displayName={displayName} doNotDisturb={doNotDisturb} dndLoading={dndLoading} onToggleDnd={() => void toggleDoNotDisturb()} onProfileUpdated={(updatedProfile) => { setProfile(updatedProfile); setProfiles((previous) => previous.map((item) => item.id === updatedProfile.id ? updatedProfile : item)) }} />}

        <footer className="app-footer"><span>FOCENTRA<span className="footer-dot">.</span></span><span>Build better habits, one session at a time.</span><span className="app-footer-credit">Made by Rohith Rao</span></footer>
      </main>

      {sessionCompletionPending && (
        <div className="focus-completion-overlay" role="presentation">
          <section className="focus-completion-modal" role="dialog" aria-modal="true" aria-labelledby="focus-completion-title">
            <div className="focus-completion-icon"><Check size={24} /></div>
            <div className="focus-completion-eyebrow">SESSION COMPLETE · {pendingSessionMinutes} MINUTES</div>
            <h2 id="focus-completion-title">What did you study?</h2>
            <p>Save the subject and a short description. Matching completed sessions automatically count toward your goals—goals cannot be marked complete manually.</p>
            <form onSubmit={(event) => void saveCompletedFocusSession(event)} className="focus-completion-form">
              <label htmlFor="focus-session-subject">Subject</label>
              <input id="focus-session-subject" value={sessionSubject} onChange={(event) => setSessionSubject(event.target.value)} placeholder="e.g. Physics, Organic Chemistry, Maths" maxLength={80} autoFocus required />
              <label htmlFor="focus-session-description">What did you work on?</label>
              <textarea id="focus-session-description" value={sessionDescription} onChange={(event) => setSessionDescription(event.target.value)} placeholder="e.g. Revised electrostatics and solved 12 numericals" maxLength={500} rows={3} required />
              {focusSessionError && <div className="focus-completion-error" role="alert">{focusSessionError}</div>}
              <button type="submit" className="focus-completion-save" disabled={savingFocusSession}>{savingFocusSession ? 'Saving session…' : 'Save completed session'} <ArrowRight size={16} /></button>
            </form>
          </section>
        </div>
      )}
    </div>
  )
}

export default App

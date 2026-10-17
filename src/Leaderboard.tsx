import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  ArrowUpRight,
  Clock3,
  Crown,
  Medal,
  RefreshCw,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { supabase } from './lib/supabaseClient'
import './Leaderboard.css'

type Period = 'week' | 'month' | 'all'

type LeaderboardEntry = {
  user_id: string
  username: string | null
  display_name: string | null
  avatar_url?: string | null
  focus_minutes: number | string
  sessions_completed: number | string
  rank_position: number | string
  goal_credits: number | string
  leaderboard_points: number | string
}

type ProfileAvatar = {
  id: string
  avatar_url: string | null
}

type Props = {
  userId: string
  onStartFocus: () => void
}

const periods: { value: Period; label: string }[] = [
  { value: 'week', label: 'This week' },
  { value: 'month', label: 'This month' },
  { value: 'all', label: 'All time' },
]

function formatMinutes(value: number | string) {
  const minutes = Math.max(0, Number(value) || 0)
  const hours = Math.floor(minutes / 60)
  const remaining = minutes % 60

  if (hours === 0) return `${remaining}m`
  if (remaining === 0) return `${hours}h`
  return `${hours}h ${remaining}m`
}

function getInitials(name: string) {
  return (
    name
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map((part) => part[0] ?? '')
      .join('')
      .toUpperCase() || 'S'
  )
}

function displayName(entry: LeaderboardEntry) {
  return entry.display_name?.trim() || entry.username?.trim() || 'FOCENTRA student'
}

function ProfileAvatarView({
  entry,
  className,
  imageClassName,
}: {
  entry: LeaderboardEntry
  className: string
  imageClassName?: string
}) {
  const [imageFailed, setImageFailed] = useState(false)

  const avatarUrl = entry.avatar_url?.trim()

  useEffect(() => {
    setImageFailed(false)
  }, [avatarUrl])

  return (
    <span
      className={className}
      aria-label={`${displayName(entry)}'s profile picture`}
    >
      {avatarUrl && !imageFailed ? (
        <img
          className={imageClassName ?? 'leaderboard-avatar-image'}
          src={avatarUrl}
          alt={`${displayName(entry)}'s profile`}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span className="leaderboard-avatar-fallback" aria-hidden="true">
          {getInitials(displayName(entry))}
        </span>
      )}
    </span>
  )
}

export default function Leaderboard({ userId, onStartFocus }: Props) {
  const [period, setPeriod] = useState<Period>('week')
  const [entries, setEntries] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState('')

  const loadLeaderboard = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)

    setError('')

    try {
      const { data, error: queryError } = await supabase.rpc(
        'get_focus_leaderboard',
        {
          p_period: period,
          p_limit: 100,
        },
      )

      if (queryError) {
        setError(
          queryError.message.includes('get_focus_leaderboard')
            ? 'The leaderboard database setup has not been run yet. Run leaderboard-schema.sql in your Supabase SQL Editor, then refresh.'
            : queryError.message,
        )
        setEntries([])
        return
      }

      const leaderboardEntries = (data ?? []) as LeaderboardEntry[]

      if (leaderboardEntries.length === 0) {
        setEntries([])
        return
      }

      const userIds = [
        ...new Set(leaderboardEntries.map((entry) => entry.user_id)),
      ]

      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('id, avatar_url')
        .in('id', userIds)

      if (profileError) {
        // Keep the leaderboard available if profile-picture access is denied.
        console.warn('Could not load leaderboard avatars:', profileError.message)
        setEntries(leaderboardEntries)
        return
      }

      const avatarByUserId = new Map(
        ((profileData ?? []) as ProfileAvatar[]).map((profile) => [
          profile.id,
          profile.avatar_url,
        ]),
      )

      setEntries(
        leaderboardEntries.map((entry) => ({
          ...entry,
          avatar_url: avatarByUserId.get(entry.user_id) ?? entry.avatar_url ?? null,
        })),
      )
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : 'An unexpected error occurred while loading the leaderboard.',
      )
      setEntries([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [period])

  useEffect(() => {
    void loadLeaderboard()
  }, [loadLeaderboard])

  const currentUser = useMemo(
    () => entries.find((entry) => entry.user_id === userId),
    [entries, userId],
  )

  const podium = entries.slice(0, 3)
  const remainingEntries = entries.slice(3)

  const totalCredits = entries.reduce(
    (total, entry) => total + (Number(entry.goal_credits) || 0),
    0,
  )

  const totalPoints = entries.reduce(
    (total, entry) => total + (Number(entry.leaderboard_points) || 0),
    0,
  )

  return (
    <div className="page-content leaderboard-page">
      <div className="leaderboard-heading-row">
        <div>
          <div className="leaderboard-eyebrow">
            <span className="leaderboard-eyebrow-dot" />
            BUILD CONSISTENCY. CELEBRATE PROGRESS.
          </div>

          <h1 className="leaderboard-title">
            Leaderboard<span>.</span>
          </h1>

          <p className="leaderboard-subtitle">
            Every focused minute counts. See how your study habits stack up.
          </p>
        </div>

        <button
          className="leaderboard-refresh"
          onClick={() => void loadLeaderboard(true)}
          disabled={loading || refreshing}
          aria-label="Refresh leaderboard"
        >
          <RefreshCw
            size={16}
            className={refreshing ? 'leaderboard-spinning' : ''}
          />
          <span>{refreshing ? 'Refreshing' : 'Refresh'}</span>
        </button>
      </div>

      <section className="leaderboard-overview" aria-label="Leaderboard overview">
        <div className="leaderboard-overview-icon">
          <Trophy size={23} />
        </div>

        <div className="leaderboard-overview-copy">
          <span>FOCUS COMMUNITY</span>
          <strong>
            {entries.length.toLocaleString()}{' '}
            {entries.length === 1 ? 'student' : 'students'} on the board
          </strong>
          <small>Rankings are based on completed focus sessions.</small>
        </div>

        <div className="leaderboard-overview-total">
          <span>COMMUNITY POINTS</span>
          <strong>{totalPoints.toLocaleString()} pts</strong>
          <small>{totalCredits.toLocaleString()} goal credits earned</small>
        </div>
      </section>

      <div className="leaderboard-controls">
        <div
          className="leaderboard-periods"
          role="tablist"
          aria-label="Leaderboard time period"
        >
          {periods.map((item) => (
            <button
              key={item.value}
              role="tab"
              aria-selected={period === item.value}
              className={period === item.value ? 'active' : ''}
              onClick={() => setPeriod(item.value)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <span className="leaderboard-update-note">
          <span />
          Live data from focus sessions
        </span>
      </div>

      {error && (
        <div className="leaderboard-error" role="alert">
          <AlertCircle size={18} />
          <div>
            <strong>Could not load leaderboard</strong>
            <p>{error}</p>
          </div>
        </div>
      )}

      {loading ? (
        <div className="leaderboard-loading">
          <div className="leaderboard-loader" />
          <strong>Loading the leaderboard…</strong>
          <span>Gathering completed focus sessions</span>
        </div>
      ) : !error && entries.length === 0 ? (
        <section className="leaderboard-empty">
          <div className="leaderboard-empty-icon">
            <Trophy size={27} />
          </div>
          <h2>Be the first on the board.</h2>
          <p>
            Complete a focus session to earn your place here. Your completed
            sessions will count automatically.
          </p>
          <button
            className="leaderboard-primary-button"
            onClick={onStartFocus}
          >
            <Clock3 size={16} />
            Start a focus session
            <ArrowUpRight size={16} />
          </button>
        </section>
      ) : !error ? (
        <>
          {podium.length > 0 && (
            <section
              className={`leaderboard-podium leaderboard-podium-count-${podium.length}`}
              aria-label="Top three students"
            >
              {podium.map((entry, index) => {
                const rank = Number(entry.rank_position) || index + 1
                const isMe = entry.user_id === userId

                return (
                  <article
                    key={entry.user_id}
                    className={`leaderboard-podium-card leaderboard-podium-rank-${rank} ${
                      isMe ? 'is-current-user' : ''
                    }`}
                  >
                    <div className="leaderboard-podium-rank">
                      {rank === 1 ? (
                        <Crown size={17} />
                      ) : rank === 2 ? (
                        <Medal size={17} />
                      ) : (
                        <Trophy size={16} />
                      )}
                      <span>#{rank}</span>
                    </div>

                    <ProfileAvatarView
                      entry={entry}
                      className={`leaderboard-avatar leaderboard-avatar-${rank}`}
                    />

                    <strong className="leaderboard-person-name">
                      {displayName(entry)}
                      {isMe && <span className="leaderboard-you-tag">YOU</span>}
                    </strong>

                    <span className="leaderboard-username">
                      {entry.username ? `@${entry.username}` : 'FOCENTRA student'}
                    </span>

                    <div className="leaderboard-person-score">
                      <Zap size={15} />
                      <strong>
                        {Number(entry.leaderboard_points) || 0} pts
                      </strong>
                    </div>

                    <span className="leaderboard-session-count">
                      {formatMinutes(entry.focus_minutes)} focused ·{' '}
                      {Number(entry.goal_credits) || 0} goal credits
                    </span>
                  </article>
                )
              })}
            </section>
          )}

          <section className="leaderboard-table-card">
            <div className="leaderboard-table-heading">
              <div>
                <h2>Study standings</h2>
                <p>Consistent effort is what moves you up.</p>
              </div>
              <span>
                <Users size={15} />
                {entries.length} students
              </span>
            </div>

            <div className="leaderboard-table-wrap">
              <table className="leaderboard-table">
                <thead>
                  <tr>
                    <th scope="col">Rank</th>
                    <th scope="col">Student</th>
                    <th scope="col">Points</th>
                    <th scope="col">Goal credits</th>
                    <th scope="col">Focus time</th>
                  </tr>
                </thead>

                <tbody>
                  {(entries.length > 3
                    ? remainingEntries
                    : entries.filter(
                        (entry) => Number(entry.rank_position) > 3,
                      )
                  ).map((entry, index) => {
                    const rank = Number(entry.rank_position) || index + 4
                    const isMe = entry.user_id === userId

                    return (
                      <tr
                        key={entry.user_id}
                        className={
                          isMe ? 'leaderboard-current-row' : undefined
                        }
                      >
                        <td>
                          <span className="leaderboard-rank-number">
                            {rank}
                          </span>
                        </td>

                        <td>
                          <div className="leaderboard-table-person">
                            <ProfileAvatarView
                              entry={entry}
                              className="leaderboard-table-avatar"
                            />
                            <span className="leaderboard-table-person-copy">
                              <strong>
                                {displayName(entry)}
                                {isMe && <em>YOU</em>}
                              </strong>
                              <small>
                                {entry.username
                                  ? `@${entry.username}`
                                  : 'FOCENTRA student'}
                              </small>
                            </span>
                          </div>
                        </td>

                        <td>
                          <strong className="leaderboard-time-value">
                            {Number(entry.leaderboard_points) || 0} pts
                          </strong>
                        </td>

                        <td>
                          <span className="leaderboard-session-value">
                            <Trophy size={13} />
                            {Number(entry.goal_credits) || 0}
                          </span>
                        </td>

                        <td>
                          <strong className="leaderboard-time-value">
                            {formatMinutes(entry.focus_minutes)}
                          </strong>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {currentUser ? (
            <div className="leaderboard-your-rank">
              <ProfileAvatarView
                entry={currentUser}
                className="leaderboard-your-rank-avatar"
              />

              <div className="leaderboard-your-rank-copy">
                <span>YOUR POSITION</span>
                <strong>
                  You're ranked #{Number(currentUser.rank_position)} for{' '}
                  {period === 'week'
                    ? 'this week'
                    : period === 'month'
                      ? 'this month'
                      : 'all time'}
                  .
                </strong>
              </div>

              <button onClick={onStartFocus}>
                Keep climbing <ArrowUpRight size={15} />
              </button>
            </div>
          ) : (
            <div className="leaderboard-your-rank leaderboard-not-ranked">
              <div className="leaderboard-your-rank-icon">
                <Clock3 size={18} />
              </div>
              <div className="leaderboard-your-rank-copy">
                <span>YOUR POSITION</span>
                <strong>
                  Complete a focus session to join this leaderboard.
                </strong>
              </div>
              <button onClick={onStartFocus}>
                Start focusing <ArrowUpRight size={15} />
              </button>
            </div>
          )}
        </>
      ) : null}

      <p className="leaderboard-footnote">
        Points combine completed focus minutes with goal credits. Each goal
        awards 50 credits when its target is reached through saved focus
        sessions.
      </p>
    </div>
  )
}
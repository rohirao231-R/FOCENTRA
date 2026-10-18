import { useCallback, useEffect, useState, type FormEvent } from 'react'
import { AlertCircle, ArrowRight, CheckCircle2, Clock3, Plus, RefreshCw, Target, Trophy, Users, X } from 'lucide-react'
import { supabase } from './lib/supabaseClient'
import './Goals.css'

type GoalFriend = { id: string; name: string; username: string; initials: string; color: string }
type GoalType = 'individual' | 'group'
type StudyGoal = { id: string; creator_id: string; subject: string; target_minutes: number; goal_type: GoalType; created_at: string }
type GoalProgress = { goal_id: string; user_id: string; username: string | null; display_name: string | null; focus_minutes: number | string; target_minutes: number | string; completed: boolean; credits_awarded: number | string }
type SavedFocusSession = { id: string; user_id: string; duration_minutes: number; completed_at: string; subject?: string | null; description?: string | null }
type Props = { userId: string; friends: GoalFriend[]; completedSessions: SavedFocusSession[]; onStartFocus: () => void }

function prettyDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`
  const hours = Math.floor(minutes / 60)
  const remainder = minutes % 60
  return remainder ? `${hours}h ${remainder}m` : `${hours}h`
}

function displayPerson(person: GoalProgress) {
  return person.display_name?.trim() || person.username?.trim() || 'FOCENTRA student'
}

export default function Goals({ userId, friends, completedSessions, onStartFocus }: Props) {
  const [goals, setGoals] = useState<StudyGoal[]>([])
  const [progress, setProgress] = useState<Record<string, GoalProgress[]>>({})
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [formOpen, setFormOpen] = useState(false)
  const [subject, setSubject] = useState('')
  const [duration, setDuration] = useState(60)
  const [goalType, setGoalType] = useState<GoalType>('individual')
  const [selectedFriends, setSelectedFriends] = useState<string[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  const loadGoals = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError('')
    const { data, error: queryError } = await supabase
      .from('study_goals')
      .select('id, creator_id, subject, target_minutes, goal_type, created_at')
      .order('created_at', { ascending: false })

    if (queryError) {
      setError(queryError.message.includes('study_goals') || queryError.message.includes('schema cache')
        ? 'The Goals database setup has not been run yet. Run goals-schema.sql in your Supabase SQL Editor, then refresh.'
        : queryError.message)
      setGoals([])
      setProgress({})
      setLoading(false)
      setRefreshing(false)
      return
    }

    const nextGoals = (data ?? []) as StudyGoal[]
    setGoals(nextGoals)
    let progressResults: (readonly [string, GoalProgress[]])[] = []
    try {
      progressResults = await Promise.all(nextGoals.map(async (goal) => {
        const { data: rows, error: progressError } = await supabase.rpc('get_study_goal_progress', { p_goal_id: goal.id })
        if (progressError) throw progressError
        return [goal.id, (rows ?? []) as GoalProgress[]] as const
      }))
    } catch (progressError) {
      setError(progressError instanceof Error ? progressError.message : 'Could not load goal progress.')
    }
    setProgress(Object.fromEntries(progressResults))
    setLoading(false)
    setRefreshing(false)
  }, [])

  useEffect(() => { void loadGoals() }, [loadGoals])

  // Derive individual goal progress from saved focus sessions instead of depending on the progress RPC.
  const sessionsForGoal = (goal: StudyGoal) => completedSessions.filter((session) =>
    session.user_id === userId &&
    Boolean(session.subject?.trim()) &&
    session.subject!.trim().toLocaleLowerCase() === goal.subject.trim().toLocaleLowerCase() &&
    new Date(session.completed_at).getTime() >= new Date(goal.created_at).getTime()
  )
  const completedCount = goals.filter((goal) => {
    if (goal.goal_type === 'individual') {
      return sessionsForGoal(goal).reduce((sum, session) => sum + Number(session.duration_minutes || 0), 0) >= Number(goal.target_minutes)
    }
    return (progress[goal.id] ?? []).some((person) => person.user_id === userId && person.completed)
  }).length

  function toggleFriend(id: string) {
    setSelectedFriends((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id])
  }

  async function createGoal(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (saving) return
    setError('')
    setNotice('')
    if (subject.trim().length < 2) { setError('Enter a subject name with at least 2 characters.'); return }
    if (goalType === 'group' && selectedFriends.length === 0) { setError('Choose at least one friend for a group goal.'); return }
    setSaving(true)
    const { data, error: createError } = await supabase.rpc('create_study_goal', {
      p_subject: subject.trim(),
      p_target_minutes: duration,
      p_goal_type: goalType,
      p_friend_ids: goalType === 'group' ? selectedFriends : [],
    })
    setSaving(false)
    if (createError) {
      setError(createError.message.includes('create_study_goal') || createError.message.includes('schema cache')
        ? 'The Goals database setup has not been run yet. Run goals-schema.sql in Supabase.'
        : createError.message)
      return
    }
    setNotice(`Your ${goalType} goal for ${subject.trim()} has been created. Complete matching focus sessions to make progress.`)
    setSubject('')
    setDuration(60)
    setGoalType('individual')
    setSelectedFriends([])
    setFormOpen(false)
    await loadGoals(true)
    void data
  }

  return (
    <div className="page-content goals-page">
      <div className="goals-heading-row">
        <div>
          <div className="goals-eyebrow"><span /> PLAN YOUR PROGRESS</div>
          <h1 className="goals-title">Study Goals<span>.</span></h1>
          <p className="goals-subtitle">Choose a subject, set a study target, and finish it on your own or with friends.</p>
        </div>
        <button className="goals-create-button" onClick={() => { setFormOpen((open) => !open); setError(''); setNotice('') }}><Plus size={17} />{formOpen ? 'Close form' : 'Create goal'}</button>
      </div>

      <section className="goals-summary-strip">
        <div className="goals-summary-icon"><Target size={22} /></div>
        <div><span>YOUR GOALS</span><strong>{goals.length} active or completed</strong></div>
        <div className="goals-summary-completed"><CheckCircle2 size={18} /><strong>{completedCount} completed</strong></div>
      </section>

      {error && <div className="goals-alert goals-alert-error" role="alert"><AlertCircle size={18} /><span>{error}</span><button onClick={() => setError('')} aria-label="Dismiss error"><X size={15} /></button></div>}
      {notice && <div className="goals-alert goals-alert-success" role="status"><CheckCircle2 size={18} /><span>{notice}</span><button onClick={() => setNotice('')} aria-label="Dismiss message"><X size={15} /></button></div>}

      {formOpen && <section className="goals-form-card">
        <div className="goals-form-heading"><div><h2>Create a study goal</h2><p>Progress is tracked from completed focus timer sessions only.</p></div><button className="goals-close-form" onClick={() => setFormOpen(false)} aria-label="Close form"><X size={18} /></button></div>
        <form onSubmit={(event) => void createGoal(event)}>
          <div className="goals-form-grid">
            <div className="goals-field goals-field-wide"><label htmlFor="goal-subject">Subject</label><input id="goal-subject" value={subject} onChange={(event) => setSubject(event.target.value)} maxLength={80} placeholder="e.g. Physics, Mathematics, Biology" required /></div>
            <div className="goals-field"><label htmlFor="goal-duration">Target study duration</label><select id="goal-duration" value={duration} onChange={(event) => setDuration(Number(event.target.value))}><option value={15}>15 minutes</option><option value={25}>25 minutes</option><option value={30}>30 minutes</option><option value={45}>45 minutes</option><option value={60}>1 hour</option><option value={90}>1 hour 30 minutes</option><option value={120}>2 hours</option><option value={180}>3 hours</option><option value={240}>4 hours</option><option value={300}>5 hours</option><option value={600}>10 hours</option></select></div>
          </div>
          <div className="goals-field"><span className="goals-field-label">Goal type</span><div className="goals-type-options">
            <button type="button" className={goalType === 'individual' ? 'selected' : ''} onClick={() => { setGoalType('individual'); setSelectedFriends([]) }}><Target size={18} /><span><strong>Individual</strong><small>Work toward this target by yourself.</small></span><span className="goals-radio-dot" /></button>
            <button type="button" className={goalType === 'group' ? 'selected' : ''} onClick={() => setGoalType('group')}><Users size={18} /><span><strong>Group goal</strong><small>Invite friends to work toward the same target.</small></span><span className="goals-radio-dot" /></button>
          </div></div>
          {goalType === 'group' && <div className="goals-friend-picker"><div className="goals-friend-picker-heading"><strong>Add friends</strong><span>{selectedFriends.length} selected</span></div>
            {friends.length === 0 ? <p className="goals-no-friends">You haven't added any friends yet. Visit Friends to connect with other students first.</p> : <div className="goals-friend-list">{friends.map((friend) => <label className={`goals-friend-option ${selectedFriends.includes(friend.id) ? 'selected' : ''}`} key={friend.id}><input type="checkbox" checked={selectedFriends.includes(friend.id)} onChange={() => toggleFriend(friend.id)} /><span className={`goals-friend-avatar ${friend.color}`}>{friend.initials}</span><span className="goals-friend-name"><strong>{friend.name}</strong><small>@{friend.username}</small></span><span className="goals-checkmark"><CheckCircle2 size={17} /></span></label>)}</div>}
          </div>}
          <div className="goals-form-footnote"><Trophy size={16} /><span>Finish the target through matching focus sessions to earn <strong>50 goal credits</strong>. No manual completion button is available.</span></div>
          <div className="goals-form-actions"><button type="button" className="goals-cancel-button" onClick={() => setFormOpen(false)}>Cancel</button><button type="submit" className="goals-submit-button" disabled={saving || (goalType === 'group' && selectedFriends.length === 0)}>{saving ? 'Creating goal…' : 'Create goal'}<ArrowRight size={16} /></button></div>
        </form>
      </section>}

      <div className="goals-list-heading"><div><h2>Your study plan</h2><p>Every goal is completed automatically from verified focus sessions.</p></div><button className="goals-refresh-button" onClick={() => void loadGoals(true)} disabled={loading || refreshing} aria-label="Refresh goals"><RefreshCw size={16} className={refreshing ? 'goals-spinning' : ''} /></button></div>

      {loading ? <div className="goals-loading"><div className="goals-loader" /><strong>Loading your goals…</strong></div> : goals.length === 0 && !error ? <section className="goals-empty"><div className="goals-empty-icon"><Target size={28} /></div><h2>Your next milestone starts here.</h2><p>Create a subject-based goal and your completed focus sessions will automatically track progress.</p><button onClick={() => setFormOpen(true)} className="goals-submit-button"><Plus size={16} />Create your first goal</button><button onClick={onStartFocus} className="goals-text-button"><Clock3 size={15} />Go to Focus Timer</button></section> : <div className="goals-grid">{goals.map((goal) => {
        const people = progress[goal.id] ?? []
        const mine = people.find((person) => person.user_id === userId)
        const individualMinutes = goal.goal_type === 'individual' ? sessionsForGoal(goal).reduce((sum, session) => sum + Number(session.duration_minutes || 0), 0) : 0
        const currentMinutes = Math.max(0, goal.goal_type === 'individual' ? individualMinutes : Number(mine?.focus_minutes) || 0)
        const target = Number(goal.target_minutes) || 1
        const percent = Math.min(100, Math.round((currentMinutes / target) * 100))
        const isComplete = goal.goal_type === 'individual' ? currentMinutes >= target : Boolean(mine?.completed)
        const allComplete = people.length > 0 && people.every((person) => person.completed)
        return <article className={`goals-card ${isComplete ? 'goals-card-complete' : ''}`} key={goal.id}>
          <div className="goals-card-top"><span className={`goals-kind-pill ${goal.goal_type}`}><span />{goal.goal_type === 'group' ? 'Group goal' : 'Individual goal'}</span>{isComplete && <span className="goals-completed-pill"><CheckCircle2 size={13} />Completed</span>}</div>
          <h3>{goal.subject}</h3><div className="goals-target-line"><Clock3 size={16} /><strong>{prettyDuration(target)}</strong><span>target study time</span></div>
          <div className="goals-progress-label"><span>Your progress</span><strong>{prettyDuration(Math.min(currentMinutes, target))} / {prettyDuration(target)}</strong></div>
          <div className="goals-progress-track"><span style={{ width: `${percent}%` }} /></div>
          {isComplete ? <div className="goals-credit-earned"><Trophy size={16} /><strong>+{Number(mine?.credits_awarded) || 50} credits earned</strong></div> : <div className="goals-credit-pending"><Trophy size={15} /><span>Earn 50 credits when your target is reached</span></div>}
          {goal.goal_type === 'group' && <div className="goals-members-progress"><div className="goals-members-heading"><Users size={15} /><strong>Group progress</strong><span>{people.filter((person) => person.completed).length}/{people.length} completed</span></div>{people.map((person) => { const minutes = Math.max(0, Number(person.focus_minutes) || 0); const memberTarget = Math.max(1, Number(person.target_minutes) || target); const memberPercent = Math.min(100, Math.round(minutes / memberTarget * 100)); return <div className="goals-member-progress" key={person.user_id}><div className="goals-member-progress-label"><span>{displayPerson(person)}{person.user_id === userId ? ' (you)' : ''}</span><strong>{person.completed ? 'Completed' : `${Math.min(minutes, memberTarget)}/${memberTarget} min`}</strong></div><div className="goals-progress-track member-track"><span style={{ width: `${memberPercent}%` }} /></div></div>})}{allComplete && <div className="goals-group-complete"><CheckCircle2 size={15} />Everyone has reached the target!</div>}</div>}
          <button className="goals-focus-button" onClick={onStartFocus}><Clock3 size={15} />{isComplete ? 'Study another subject' : 'Start a focus session'}<ArrowRight size={15} /></button>
        </article>
      })}</div>}
      <p className="goals-footnote">Only saved, completed focus timer sessions count. The subject must match your goal, and progress is counted from sessions completed after the goal was created.</p>
    </div>
  )
}

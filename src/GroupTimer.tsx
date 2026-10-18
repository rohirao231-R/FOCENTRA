import { useCallback, useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Clock3, Pause, Play, RotateCcw, Users } from 'lucide-react'
import { supabase } from './lib/supabaseClient'
import './GroupTimer.css'

type Props = { userId: string; initialGroupId: string | null; onBack: () => void }
type Group = { id: string; name: string; created_by: string | null }
type SharedSession = { id: string; group_id: string; host_user_id: string; status: 'idle' | 'running' | 'paused' | 'completed'; duration_seconds: number; remaining_seconds: number; started_at: string | null; ends_at: string | null; updated_at: string }

export default function GroupTimer({ userId, initialGroupId, onBack }: Props) {
  const [groups, setGroups] = useState<Group[]>([])
  const [groupId, setGroupId] = useState(initialGroupId || '')
  const [shared, setShared] = useState<SharedSession | null>(null)
  const [minutes, setMinutes] = useState(25)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [now, setNow] = useState(Date.now())
  const group = groups.find((item) => item.id === groupId) || null
  const isHost = shared?.host_user_id === userId
  const remaining = shared?.status === 'running' && shared.ends_at
    ? Math.max(0, Math.ceil((new Date(shared.ends_at).getTime() - now) / 1000))
    : shared?.remaining_seconds ?? minutes * 60
  const formatted = `${String(Math.floor(remaining / 60)).padStart(2, '0')}:${String(remaining % 60).padStart(2, '0')}`

  const loadGroups = useCallback(async () => {
    const { data, error: loadError } = await supabase.from('study_group_members')
      .select('group_id, study_groups(id, name, created_by)').eq('user_id', userId)
    if (loadError) { setError(loadError.message); return }
    const next = (data || []).map((row: any) => row.study_groups).filter(Boolean) as Group[]
    setGroups(next)
    setGroupId((current) => current && next.some((g) => g.id === current) ? current : initialGroupId && next.some((g) => g.id === initialGroupId) ? initialGroupId : next[0]?.id || '')
  }, [userId, initialGroupId])

  const loadSession = useCallback(async (id: string) => {
    const { data, error: loadError } = await supabase.from('study_group_sessions')
      .select('*').eq('group_id', id).maybeSingle()
    if (loadError) { setError(`Shared timer setup required: ${loadError.message}`); setShared(null); return }
    setShared(data as SharedSession | null)
  }, [])

  useEffect(() => { void loadGroups() }, [loadGroups])
  useEffect(() => {
    if (!groupId) { setShared(null); return }
    void loadSession(groupId)
    const channel = supabase.channel(`shared-study-timer-${groupId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'study_group_sessions', filter: `group_id=eq.${groupId}` }, (payload) => {
        if (payload.new && 'group_id' in payload.new) setShared(payload.new as SharedSession)
        else void loadSession(groupId)
      }).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [groupId, loadSession])
  useEffect(() => {
    const interval = window.setInterval(() => setNow(Date.now()), 500)
    return () => window.clearInterval(interval)
  }, [])
  useEffect(() => {
    if (!shared || shared.status !== 'running' || remaining > 0 || !isHost || busy) return
    void updateSession({ status: 'completed', remaining_seconds: 0, ends_at: null })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, shared?.status, shared?.id, isHost])

  async function updateSession(values: Partial<SharedSession>) {
    if (!groupId || !isHost || busy) return
    setBusy(true); setError('')
    const { data, error: updateError } = await supabase.from('study_group_sessions').update(values)
      .eq('group_id', groupId).eq('host_user_id', userId).select('*').single()
    if (updateError) setError(updateError.message)
    else setShared(data as SharedSession)
    setBusy(false)
  }

  async function startTimer() {
    if (!groupId || !group || group.created_by !== userId || busy) return
    setBusy(true); setError('')
    const seconds = Math.max(1, minutes) * 60
    const values = { group_id: groupId, host_user_id: userId, status: 'running', duration_seconds: seconds, remaining_seconds: seconds, started_at: new Date().toISOString(), ends_at: new Date(Date.now() + seconds * 1000).toISOString(), updated_at: new Date().toISOString() }
    const result = shared
      ? await supabase.from('study_group_sessions').update(values).eq('group_id', groupId).eq('host_user_id', userId).select('*').single()
      : await supabase.from('study_group_sessions').insert(values).select('*').single()
    if (result.error) setError(`Only the study group creator can start the shared timer. ${result.error.message}`)
    else setShared(result.data as SharedSession)
    setBusy(false)
  }

  async function pauseTimer() {
    if (!shared || !isHost) return
    await updateSession({ status: 'paused', remaining_seconds: remaining, ends_at: null, updated_at: new Date().toISOString() })
  }
  async function resumeTimer() {
    if (!shared || !isHost) return
    await updateSession({ status: 'running', ends_at: new Date(Date.now() + remaining * 1000).toISOString(), updated_at: new Date().toISOString() })
  }
  async function resetTimer() {
    if (!shared || !isHost) return
    await updateSession({ status: 'idle', remaining_seconds: shared.duration_seconds, ends_at: null, updated_at: new Date().toISOString() })
  }

  return <div className="page-content group-timer-page">
    <div className="gt-heading"><button onClick={onBack}><ArrowLeft size={16} /> Study groups</button><span>FOCENTRA · STUDY TOGETHER</span><h1>Group <em>timer.</em></h1><p>One shared countdown for every member, synced in real time.</p></div>
    {error && <div className="gt-error" role="alert">{error}</div>}
    <section className="gt-card">
      <label className="gt-select-label">Choose a group<select value={groupId} onChange={(e) => setGroupId(e.target.value)}><option value="">Select a group</option>{groups.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}</select></label>
      {!groups.length ? <p>Join or create a study group first, then open its shared timer.</p> : <>
        <div className="gt-status"><Users size={16} /> {group?.name || 'Study group'} · {shared?.status || 'not started'}{isHost ? ' · You are the host' : ' · Following host'}</div>
        <div className="gt-clock">{formatted}</div>
        <p className="gt-caption">{shared?.status === 'running' ? 'Focus together. Your timer is synchronized.' : shared?.status === 'paused' ? 'The host has paused this session.' : shared?.status === 'completed' ? 'Session complete. The host can start another.' : 'Waiting for the group host to start a session.'}</p>
        {group?.created_by === userId && <div className="gt-host-controls">
          {!shared || ['idle', 'completed'].includes(shared.status) ? <><label>Focus length (minutes)<input type="number" min="1" max="180" value={minutes} onChange={(e) => setMinutes(Math.max(1, Math.min(180, Number(e.target.value) || 1)))} /></label><button onClick={() => void startTimer()} disabled={busy}><Play size={16} /> Start shared timer</button></>
            : shared.status === 'running' ? <button onClick={() => void pauseTimer()} disabled={busy}><Pause size={16} /> Pause for everyone</button>
            : <button onClick={() => void resumeTimer()} disabled={busy}><Play size={16} /> Resume for everyone</button>}
          {shared && <button className="gt-secondary" onClick={() => void resetTimer()} disabled={busy}><RotateCcw size={16} /> Reset</button>}
        </div>}
        {group?.created_by !== userId && <p className="gt-readonly">Only the group creator (host) can start, pause, resume, or reset this timer.</p>}
      </>}
    </section>
  </div>
}

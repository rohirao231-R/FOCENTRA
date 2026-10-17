import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import { ArrowLeft, BookOpen, Check, GraduationCap, LoaderCircle, LockKeyhole, MessageCircle, Search, Send, Users, X, Plus, Link2, Globe2, Trash2 } from 'lucide-react'
import { supabase } from './lib/supabaseClient'
import './StudyGroups.css'

type Visibility = 'public' | 'private'
type StudyGroup = { id: string; slug: string; name: string; description: string; category: string; visibility: Visibility; created_by: string | null }
type GroupMessage = { id: string; group_id: string; sender_id: string; content: string; created_at: string }
type GroupProfile = { id: string; username: string; display_name: string; created_at?: string }
type Props = { userId: string; currentProfile: GroupProfile | null }

const categories = ['General', 'JEE', 'CBSE', 'State Board', 'Matriculation', 'UPSC', 'NEET', 'College', 'Other']
const prettyTime = (date: string) => new Date(date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
const initials = (name: string) => name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'S'
const makeSlug = (name: string) => `${name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 36) || 'study-group'}-${Math.random().toString(36).slice(2, 8)}`

export default function StudyGroups({ userId, currentProfile }: Props) {
  const [groups, setGroups] = useState<StudyGroup[]>([])
  const [joinedIds, setJoinedIds] = useState<string[]>([])
  const [activeGroup, setActiveGroup] = useState<StudyGroup | null>(null)
  const [messages, setMessages] = useState<GroupMessage[]>([])
  const [profiles, setProfiles] = useState<Record<string, GroupProfile>>({})
  const [selectedProfile, setSelectedProfile] = useState<GroupProfile | null>(null)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState('')
  const [loading, setLoading] = useState(true)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [joining, setJoining] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [creating, setCreating] = useState(false)
  const [groupName, setGroupName] = useState('')
  const [groupPurpose, setGroupPurpose] = useState('')
  const [groupCategory, setGroupCategory] = useState('General')
  const [groupVisibility, setGroupVisibility] = useState<Visibility>('public')
  const [inviteBusy, setInviteBusy] = useState(false)
  const [deletingGroup, setDeletingGroup] = useState(false)
  const [inviteNotice, setInviteNotice] = useState('')

  const joinedGroups = useMemo(() => groups.filter((group) => joinedIds.includes(group.id)), [groups, joinedIds])
  const publicGroups = useMemo(() => groups.filter((group) => group.visibility === 'public'), [groups])
  const filteredGroups = useMemo(() => publicGroups.filter((group) => `${group.name} ${group.description} ${group.category}`.toLowerCase().includes(search.toLowerCase())), [publicGroups, search])
  const isMember = Boolean(activeGroup && joinedIds.includes(activeGroup.id))
  const isOwner = Boolean(activeGroup && activeGroup.created_by === userId)

  const loadGroups = useCallback(async () => {
    setLoading(true)
    setError('')
    const [groupResult, memberResult] = await Promise.all([
      supabase.from('study_groups').select('id, slug, name, description, category, visibility, created_by').order('name'),
      supabase.from('study_group_members').select('group_id').eq('user_id', userId),
    ])
    if (groupResult.error) setError(`Could not load study groups: ${groupResult.error.message}`)
    else setGroups((groupResult.data ?? []) as StudyGroup[])
    if (memberResult.error) setError((previous) => previous || `Could not load your joined groups: ${memberResult.error.message}`)
    else setJoinedIds((memberResult.data ?? []).map((row: { group_id: string }) => row.group_id))
    setLoading(false)
  }, [userId])

  const loadMessages = useCallback(async (groupId: string) => {
    setMessagesLoading(true)
    const { data, error: messageError } = await supabase.from('study_group_messages').select('id, group_id, sender_id, content, created_at').eq('group_id', groupId).order('created_at', { ascending: true }).limit(300)
    if (messageError) {
      setError(`Could not load group messages: ${messageError.message}`)
      setMessages([])
      setMessagesLoading(false)
      return
    }
    const nextMessages = (data ?? []) as GroupMessage[]
    setMessages(nextMessages)
    const ids = [...new Set(nextMessages.map((message) => message.sender_id))]
    if (currentProfile?.id) ids.push(currentProfile.id)
    if (ids.length) {
      const { data: profileData } = await supabase.from('profiles').select('id, username, display_name, created_at').in('id', [...new Set(ids)])
      if (profileData) setProfiles((previous) => ({ ...previous, ...Object.fromEntries((profileData as GroupProfile[]).map((item) => [item.id, item])) }))
    }
    setMessagesLoading(false)
  }, [currentProfile?.id])

  useEffect(() => { void loadGroups() }, [loadGroups])

  // A private invite URL automatically validates the token and joins the signed-in student.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const inviteToken = params.get('studyInvite')
    if (!inviteToken) return
    let cancelled = false
    ;(async () => {
      setError('')
      const { data, error: inviteError } = await supabase.rpc('join_study_group_by_invite', { p_token: inviteToken })
      if (cancelled) return
      if (inviteError) {
        setError(`This invite link is invalid or has expired: ${inviteError.message}`)
        return
      }
      const row = (Array.isArray(data) ? data[0] : data) as StudyGroup | null
      if (!row?.id) {
        setError('This invite link is invalid or has expired.')
        return
      }
      setJoinedIds((previous) => previous.includes(row.id) ? previous : [...previous, row.id])
      setGroups((previous) => previous.some((item) => item.id === row.id) ? previous.map((item) => item.id === row.id ? row : item) : [...previous, row])
      setActiveGroup(row)
      window.history.replaceState({}, '', `${window.location.pathname}${window.location.hash}`)
      void loadGroups()
    })()
    return () => { cancelled = true }
  }, [loadGroups])

  useEffect(() => {
    if (!activeGroup || !isMember) return
    void loadMessages(activeGroup.id)
    const channel = supabase.channel(`study-group-messages-${activeGroup.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'study_group_messages', filter: `group_id=eq.${activeGroup.id}` }, (payload) => {
        const message = payload.new as GroupMessage
        setMessages((previous) => previous.some((item) => item.id === message.id) ? previous : [...previous, message].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()))
        void supabase.from('profiles').select('id, username, display_name, created_at').eq('id', message.sender_id).maybeSingle().then(({ data }) => {
          if (data) setProfiles((previous) => ({ ...previous, [data.id]: data as GroupProfile }))
        })
      }).subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [activeGroup, isMember, loadMessages])

  async function joinGroup(group: StudyGroup) {
    setJoining(true); setError('')
    const { error: joinError } = await supabase.from('study_group_members').insert({ group_id: group.id, user_id: userId })
    if (joinError && joinError.code !== '23505') setError(`Could not join ${group.name}: ${joinError.message}`)
    else {
      setJoinedIds((previous) => previous.includes(group.id) ? previous : [...previous, group.id])
      setActiveGroup(group)
    }
    setJoining(false)
  }

  async function createGroup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const name = groupName.trim()
    const purpose = groupPurpose.trim()
    if (!name || !purpose || creating) return
    if (name.length > 70 || purpose.length > 400) { setError('Use a group name under 70 characters and a purpose under 400 characters.'); return }
    setCreating(true); setError('')
    const { data, error: createError } = await supabase.rpc('create_study_group', {
      p_name: name,
      p_purpose: purpose,
      p_visibility: groupVisibility,
      p_category: groupCategory,
      p_slug: makeSlug(name),
    })
    if (createError) {
      setError(`Could not create your study group: ${createError.message}`)
    } else {
      const created = (Array.isArray(data) ? data[0] : data) as StudyGroup | null
      if (!created?.id) setError('The group may have been created, but its details could not be loaded. Refresh and check Your groups.')
      else {
        setGroups((previous) => [created, ...previous.filter((item) => item.id !== created.id)])
        setJoinedIds((previous) => previous.includes(created.id) ? previous : [...previous, created.id])
        setActiveGroup(created)
        setShowCreate(false)
        setGroupName(''); setGroupPurpose(''); setGroupCategory('General'); setGroupVisibility('public')
      }
    }
    setCreating(false)
  }

  async function copyInviteLink() {
    if (!activeGroup || !isOwner || inviteBusy) return
    setInviteBusy(true); setInviteNotice(''); setError('')
    const { data, error: tokenError } = await supabase.rpc('get_study_group_invite_token', { p_group_id: activeGroup.id })
    if (tokenError || !data) {
      setError(`Could not create invite link: ${tokenError?.message || 'No invite token returned.'}`)
      setInviteBusy(false)
      return
    }
    const token = String(data)
    const link = `${window.location.origin}${window.location.pathname}?studyInvite=${encodeURIComponent(token)}`
    try {
      await navigator.clipboard.writeText(link)
      setInviteNotice('Invite link copied. Share it with the students you want to invite.')
    } catch {
      window.prompt('Copy this private study group invite link:', link)
      setInviteNotice('Share this link with invited students. Anyone with the link can join this private group.')
    }
    setInviteBusy(false)
  }

  async function leaveGroup(group: StudyGroup) {
    if (group.created_by === userId) {
      setError('You created this group. Use Delete group if you want to remove it permanently.')
      return
    }
    if (!window.confirm(`Leave ${group.name}? You can join again any time if it is public, or use an invite link if it is private.`)) return
    const { error: leaveError } = await supabase.from('study_group_members').delete().eq('group_id', group.id).eq('user_id', userId)
    if (leaveError) { setError(`Could not leave group: ${leaveError.message}`); return }
    setJoinedIds((previous) => previous.filter((id) => id !== group.id))
    if (activeGroup?.id === group.id) { setActiveGroup(null); setMessages([]) }
  }

  async function deleteGroup(group: StudyGroup) {
    if (group.created_by !== userId || deletingGroup) return
    const confirmed = window.confirm(`Delete \"${group.name}\" permanently? This removes the group, its messages, and all memberships. This cannot be undone.`)
    if (!confirmed) return
    setDeletingGroup(true)
    setError('')
    const { error: deleteError } = await supabase.from('study_groups').delete().eq('id', group.id).eq('created_by', userId)
    if (deleteError) {
      setError(`Could not delete study group: ${deleteError.message}`)
      setDeletingGroup(false)
      return
    }
    setGroups((previous) => previous.filter((item) => item.id !== group.id))
    setJoinedIds((previous) => previous.filter((id) => id !== group.id))
    if (activeGroup?.id === group.id) {
      setActiveGroup(null)
      setMessages([])
      setSelectedProfile(null)
      setInviteNotice('')
    }
    setDeletingGroup(false)
  }

  async function sendMessage(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const content = draft.trim()
    if (!activeGroup || !isMember || !content || sending) return
    if (content.length > 2000) { setError('Messages must be 2,000 characters or fewer.'); return }
    setSending(true); setError('')
    const { data, error: sendError } = await supabase.from('study_group_messages').insert({ group_id: activeGroup.id, sender_id: userId, content }).select('id, group_id, sender_id, content, created_at').single()
    if (sendError) setError(`Message could not be sent: ${sendError.message}`)
    else {
      const saved = data as GroupMessage
      setMessages((previous) => previous.some((item) => item.id === saved.id) ? previous : [...previous, saved].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()))
      setDraft('')
      if (currentProfile) setProfiles((previous) => ({ ...previous, [userId]: currentProfile }))
    }
    setSending(false)
  }

  if (activeGroup && isMember) {
    const privateGroup = activeGroup.visibility === 'private'
    return <div className="page-content study-groups-page">
      <div className="sg-chat-heading"><button className="sg-back-button" onClick={() => { setActiveGroup(null); setSelectedProfile(null); setInviteNotice('') }}><ArrowLeft size={16} /> All groups</button><div className="sg-group-heading-icon">{privateGroup ? <LockKeyhole size={22} /> : <GraduationCap size={23} />}</div><div className="sg-group-heading-copy"><span>{privateGroup ? 'PRIVATE STUDY GROUP' : 'PUBLIC STUDY GROUP'}</span><h1>{activeGroup.name}</h1><p>{activeGroup.description}</p></div><div className="sg-chat-actions">{isOwner && privateGroup && <button className="sg-invite-button" onClick={() => void copyInviteLink()} disabled={inviteBusy}><Link2 size={15} />{inviteBusy ? 'Creating link…' : 'Invite link'}</button>}{isOwner ? <><span className="sg-owner-pill">Your group</span><button className="sg-delete-button" onClick={() => void deleteGroup(activeGroup)} disabled={deletingGroup}><Trash2 size={15} />{deletingGroup ? 'Deleting…' : 'Delete group'}</button></> : <button className="sg-leave-button" onClick={() => void leaveGroup(activeGroup)}>Leave group</button>}</div></div>
      {error && <div className="sg-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={14} /></button></div>}
      {inviteNotice && <div className="sg-success" role="status"><Check size={15} />{inviteNotice}<button onClick={() => setInviteNotice('')} aria-label="Dismiss message"><X size={14} /></button></div>}
      <section className="sg-chat-panel"><div className="sg-chat-topline"><div><strong><MessageCircle size={16} /> Group conversation</strong><span>Profiles are available from messages. The member list is private.</span></div><span className={`sg-public-pill ${privateGroup ? 'sg-private-pill' : ''}`}>{privateGroup ? <><LockKeyhole size={12} /> Private</> : <><Globe2 size={12} /> Public</>} group</span></div>
        <div className="sg-messages" aria-live="polite">
          {messagesLoading ? <div className="sg-empty"><LoaderCircle size={22} className="sg-spin" />Loading messages…</div> : messages.length === 0 ? <div className="sg-empty"><MessageCircle size={28} /><strong>Start the conversation</strong><p>Introduce yourself or share what you are studying today.</p></div> : messages.map((message) => {
            const sender = profiles[message.sender_id]
            const senderName = sender?.display_name || sender?.username || (message.sender_id === userId ? currentProfile?.display_name || 'You' : 'Student')
            const mine = message.sender_id === userId
            return <article className={`sg-message ${mine ? 'sg-message-mine' : ''}`} key={message.id}><div className="sg-message-avatar">{initials(senderName)}</div><div className="sg-message-body"><div className="sg-message-meta"><button onClick={() => sender && setSelectedProfile(sender)} disabled={!sender} className="sg-sender-name">{mine ? `${senderName} (you)` : senderName}</button><time>{prettyTime(message.created_at)}</time></div><p>{message.content}</p></div></article>
          })}
        </div>
        <form className="sg-composer" onSubmit={sendMessage}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder={`Message ${activeGroup.name}…`} aria-label="Write a group message" maxLength={2000} disabled={sending} /><button type="submit" aria-label="Send group message" disabled={!draft.trim() || sending}><Send size={17} /></button></form>
      </section>
      {selectedProfile && <div className="sg-modal-backdrop" onClick={() => setSelectedProfile(null)}><section className="sg-profile-card" role="dialog" aria-modal="true" aria-label="Student profile" onClick={(event) => event.stopPropagation()}><button className="sg-profile-close" onClick={() => setSelectedProfile(null)} aria-label="Close profile"><X size={17} /></button><div className="sg-profile-avatar">{initials(selectedProfile.display_name || selectedProfile.username)}</div><h2>{selectedProfile.display_name || selectedProfile.username}</h2><p>@{selectedProfile.username}</p><div className="sg-profile-detail"><span>FOCENTRA STUDENT</span><strong>{selectedProfile.created_at ? `Joined ${new Date(selectedProfile.created_at).toLocaleDateString([], { month: 'long', year: 'numeric' })}` : 'Study community member'}</strong></div><button className="sg-profile-done" onClick={() => setSelectedProfile(null)}><Check size={15} /> Done</button></section></div>}
    </div>
  }

  return <div className="page-content study-groups-page">
    <div className="sg-page-title-row"><div className="page-heading"><div><span className="page-eyebrow">LEARN TOGETHER</span><h1>Study <span>groups.</span></h1><p>Join a public community or create a group for your own study circle.</p></div></div><button className="sg-create-button" onClick={() => setShowCreate(true)}><Plus size={17} /> Create study group</button></div>
    <div className="sg-hero"><div className="sg-hero-icon"><Users size={26} /></div><div><span>YOUR STUDY COMMUNITY</span><h2>Find your people. Learn together.</h2><p>Public groups are searchable. Private groups can only be joined through an invite link.</p></div><div className="sg-hero-stat"><strong>{joinedGroups.length}</strong><span>groups joined</span></div></div>
    {error && <div className="sg-error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error"><X size={14} /></button></div>}
    <section className="sg-directory"><div className="sg-directory-heading"><div><h2>Explore public groups</h2><p>Search and join public groups. Private groups never appear in search.</p></div><label className="sg-search"><Search size={15} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search public groups…" /></label></div>
      {loading ? <div className="sg-loading"><LoaderCircle size={22} className="sg-spin" />Loading study groups…</div> : <div className="sg-grid">{filteredGroups.map((group) => { const joined = joinedIds.includes(group.id); return <article className="sg-card" key={group.id}><div className="sg-card-top"><div className="sg-card-icon"><BookOpen size={21} /></div><span className="sg-category">{group.category}</span></div><h3>{group.name}</h3><p>{group.description}</p><div className="sg-card-bottom"><span><Globe2 size={14} /> Public group</span>{joined ? <button className="sg-open-button" onClick={() => setActiveGroup(group)}><MessageCircle size={14} /> Open chat</button> : <button className="sg-join-button" onClick={() => void joinGroup(group)} disabled={joining}><Plus size={15} /> {joining ? 'Joining…' : 'Join group'}</button>}</div></article> })}</div>}
      {!loading && filteredGroups.length === 0 && <div className="sg-empty"><Search size={24} /><strong>No public groups found</strong><p>Try another search or create a new study group.</p></div>}
    </section>
    {joinedGroups.length > 0 && <section className="sg-joined-section"><h2>Your groups</h2><p className="sg-section-subtitle">This includes public groups and private groups you joined by invite.</p><div className="sg-joined-list">{joinedGroups.map((group) => <button key={group.id} onClick={() => setActiveGroup(group)}><span className="sg-joined-icon">{group.visibility === 'private' ? <LockKeyhole size={17} /> : <GraduationCap size={17} />}</span><span><strong>{group.name}</strong><small>{group.visibility === 'private' ? 'Private group' : group.category}</small></span><MessageCircle size={16} /></button>)}</div></section>}
    {showCreate && <div className="sg-modal-backdrop" onClick={() => setShowCreate(false)}><section className="sg-create-modal" role="dialog" aria-modal="true" aria-labelledby="sg-create-title" onClick={(event) => event.stopPropagation()}><button className="sg-profile-close" onClick={() => setShowCreate(false)} aria-label="Close create group dialog"><X size={17} /></button><div className="sg-create-modal-icon"><Users size={22} /></div><h2 id="sg-create-title">Create a study group</h2><p className="sg-create-intro">Set up a space for students to study, discuss questions, and help each other.</p><form onSubmit={createGroup} className="sg-create-form"><label>Group name<input value={groupName} onChange={(event) => setGroupName(event.target.value)} placeholder="e.g. Class 12 Physics Squad" maxLength={70} required /></label><label>Purpose / description<textarea value={groupPurpose} onChange={(event) => setGroupPurpose(event.target.value)} placeholder="What will this group help students with?" maxLength={400} rows={3} required /></label><label>Category<select value={groupCategory} onChange={(event) => setGroupCategory(event.target.value)}>{categories.map((category) => <option key={category} value={category}>{category}</option>)}</select></label><fieldset><legend>Who can join?</legend><label className={`sg-visibility-option ${groupVisibility === 'public' ? 'selected' : ''}`}><input type="radio" name="group-visibility" value="public" checked={groupVisibility === 'public'} onChange={() => setGroupVisibility('public')} /><Globe2 size={19} /><span><strong>Public</strong><small>Anyone can find this group in search and join.</small></span></label><label className={`sg-visibility-option ${groupVisibility === 'private' ? 'selected' : ''}`}><input type="radio" name="group-visibility" value="private" checked={groupVisibility === 'private'} onChange={() => setGroupVisibility('private')} /><LockKeyhole size={19} /><span><strong>Private</strong><small>Hidden from search. People join using your invite link.</small></span></label></fieldset><div className="sg-create-actions"><button type="button" className="sg-cancel-button" onClick={() => setShowCreate(false)}>Cancel</button><button type="submit" className="sg-create-submit" disabled={creating || !groupName.trim() || !groupPurpose.trim()}>{creating ? <><LoaderCircle size={15} className="sg-spin" /> Creating…</> : <><Plus size={15} /> Create group</>}</button></div></form></section></div>}
  </div>
}

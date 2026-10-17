
import {
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react'
import {
  BellOff,
  Check,
  ChevronDown,
  CircleUserRound,
  KeyRound,
  Mail,
  Moon,
  Pencil,
  Camera,
  Save,
  Settings2,
  ShieldCheck,
  X,
} from 'lucide-react'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabaseClient'

type UserProfile = {
  id: string
  username: string
  display_name: string
  created_at?: string
  do_not_disturb?: boolean
  avatar_url?: string | null
}

type Props = {
  session: Session
  profile: UserProfile | null
  displayName: string
  doNotDisturb: boolean
  dndLoading: boolean
  onToggleDnd: () => void
  onProfileUpdated: (profile: UserProfile) => void
}

export default function Profile({
  session,
  profile,
  displayName,
  doNotDisturb,
  dndLoading,
  onToggleDnd,
  onProfileUpdated,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [username, setUsername] = useState(
    profile?.username ??
      session.user.user_metadata?.username ??
      session.user.email?.split('@')[0] ??
      '',
  )
  const [name, setName] = useState(
    profile?.display_name ?? displayName,
  )
  const [newEmail, setNewEmail] = useState(
    session.user.email ?? '',
  )
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const metadataAvatar = session.user.user_metadata?.avatar_url
  const avatarUrl =
    profile?.avatar_url ||
    (typeof metadataAvatar === 'string' ? metadataAvatar : '')

  const initials =
    (name || username || session.user.email || 'S')
      .split(/[\s@._-]+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part: string) => part[0]?.toUpperCase())
      .join('') || 'S'

  async function saveProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError('')
    setMessage('')

    try {
      const cleanUsername = username.trim().replace(/^@/, '')
      const cleanName = name.trim()

      if (!cleanUsername || cleanUsername.length < 3) {
        throw new Error('Username must be at least 3 characters.')
      }

      if (!/^[a-zA-Z0-9_.-]+$/.test(cleanUsername)) {
        throw new Error(
          'Username can only contain letters, numbers, dots, underscores, and hyphens.',
        )
      }

      if (!cleanName) {
        throw new Error('Display name cannot be empty.')
      }

      const { data, error: updateError } = await supabase
        .from('profiles')
        .update({
          username: cleanUsername,
          display_name: cleanName,
        })
        .eq('id', session.user.id)
        .select(
          'id, username, display_name, created_at, do_not_disturb, avatar_url',
        )
        .single()

      if (updateError) {
        console.error('[Profile] Profile save failed:', updateError)
        throw new Error(`PROFILE SAVE FAILED: ${updateError.message}`)
      }

      onProfileUpdated(data as UserProfile)
      setUsername(cleanUsername)
      setName(cleanName)
      setEditing(false)

      if (
        newEmail.trim().toLowerCase() !==
        (session.user.email ?? '').toLowerCase()
      ) {
        const { error: emailError } =
          await supabase.auth.updateUser({
            email: newEmail.trim(),
          })

        if (emailError) throw emailError

        setMessage(
          'Profile saved. Check your email inbox to confirm the email change. Your account email updates after confirmation.',
        )
      } else {
        setMessage('Your profile has been updated.')
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not update your profile.',
      )
    } finally {
      setSaving(false)
    }
  }

  async function uploadAvatar(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (!file) return

    setError('')
    setMessage('')

    if (!file.type.startsWith('image/')) {
      setError('Choose an image file.')
      event.target.value = ''
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      setError('Profile pictures must be 5 MB or smaller.')
      event.target.value = ''
      return
    }

    setUploading(true)

    try {
      // Refresh the session to ensure the request has a valid access token.
      const {
        data: { session: currentSession },
        error: sessionError,
      } = await supabase.auth.getSession()

      if (sessionError) {
        throw new Error(
          `AUTH SESSION CHECK FAILED: ${sessionError.message}`,
        )
      }

      if (!currentSession?.user?.id) {
        throw new Error(
          'You are not signed in. Please sign in again and retry.',
        )
      }

      const userId = currentSession.user.id

      // Verify that the session passed to this component is still current.
      if (userId !== session.user.id) {
        console.warn('[Avatar] Session user differs from component user.', {
          currentUserId: userId,
          componentUserId: session.user.id,
        })
      }

      const { error: refreshError } =
        await supabase.auth.refreshSession()

      if (refreshError) {
        console.error('[Avatar] Session refresh failed:', refreshError)
        throw new Error(
          `AUTH SESSION REFRESH FAILED: ${refreshError.message}`,
        )
      }

      const {
        data: { session: refreshedSession },
        error: refreshedSessionError,
      } = await supabase.auth.getSession()

      if (refreshedSessionError || !refreshedSession?.user?.id) {
        throw new Error(
          'Your session could not be verified. Please sign in again.',
        )
      }

      const authenticatedUserId = refreshedSession.user.id

      if (authenticatedUserId !== userId) {
        throw new Error(
          'Your signed-in account changed. Refresh the page and try again.',
        )
      }

      const extFromName = file.name.split('.').pop()?.toLowerCase()
      const safeExt =
        extFromName && /^[a-z0-9]{1,10}$/.test(extFromName)
          ? extFromName
          : file.type === 'image/png'
            ? 'png'
            : file.type === 'image/webp'
              ? 'webp'
              : file.type === 'image/gif'
                ? 'gif'
                : 'jpg'

      // The first folder must match auth.uid() in the Storage RLS policy.
      const path = `${authenticatedUserId}/${crypto.randomUUID()}.${safeExt}`

      console.log('[Avatar] Upload diagnostics:', {
        bucket: 'avatars',
        authenticated: !!refreshedSession.access_token,
        userIdPresent: !!authenticatedUserId,
        pathStartsWithUserId:
          path.split('/')[0] === authenticatedUserId,
        fileType: file.type,
        fileSize: file.size,
      })

      if (path.split('/')[0] !== authenticatedUserId) {
        throw new Error(
          'Avatar upload path does not match the signed-in user.',
        )
      }

      const { data: uploadData, error: uploadError } =
        await supabase.storage.from('avatars').upload(path, file, {
          upsert: false,
          contentType: file.type,
          cacheControl: '3600',
        })

      if (uploadError) {
        console.error('[Avatar] STORAGE UPLOAD FAILED:', {
          message: uploadError.message,
          name: uploadError.name,
          statusCode: (uploadError as { statusCode?: string }).statusCode,
          bucket: 'avatars',
          pathStartsWithUserId:
            path.split('/')[0] === authenticatedUserId,
          userIdPresent: !!authenticatedUserId,
        })

        throw new Error(
          `STORAGE UPLOAD FAILED: ${uploadError.message}. ` +
            'Check that the avatars bucket exists in this Supabase project and that its INSERT policy allows authenticated users to upload into their own user-ID folder.',
        )
      }

      console.log('[Avatar] Storage upload succeeded:', {
        bucket: 'avatars',
        path: uploadData.path,
      })

      const { data: urlData } = supabase.storage
        .from('avatars')
        .getPublicUrl(uploadData.path)

      if (!urlData.publicUrl) {
        throw new Error(
          'The file uploaded, but Supabase did not return a public URL.',
        )
      }

      console.log('[Avatar] Updating profiles.avatar_url')

      const { data: updated, error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: urlData.publicUrl })
        .eq('id', authenticatedUserId)
        .select(
          'id, username, display_name, created_at, do_not_disturb, avatar_url',
        )
        .single()

      if (updateError) {
        console.error('[Avatar] PROFILE UPDATE FAILED:', updateError)
        throw new Error(
          `PROFILE UPDATE FAILED: ${updateError.message}. ` +
            'The image was uploaded, but the profiles table may need an UPDATE policy for this user.',
        )
      }

      onProfileUpdated(updated as UserProfile)
      setMessage('Profile picture updated.')
      console.log('[Avatar] Profile picture update completed.')
    } catch (err) {
      const detail =
        err instanceof Error ? err.message : String(err)

      console.error('[Avatar] FINAL ERROR:', detail)
      setError(detail)
    } finally {
      setUploading(false)

      if (fileRef.current) {
        fileRef.current.value = ''
      }
    }
  }

  async function changePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError('')
    setMessage('')

    if (password.length < 8) {
      setError('Use at least 8 characters for your new password.')
      return
    }

    if (password !== confirmPassword) {
      setError('The passwords do not match.')
      return
    }

    setSaving(true)

    try {
      const { error: updateError } = await supabase.auth.updateUser({
        password,
      })

      if (updateError) throw updateError

      setPassword('')
      setConfirmPassword('')
      setShowPassword(false)
      setMessage('Password updated successfully.')
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Could not change password.',
      )
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="page-content profile-page">
      <div className="profile-page-heading">
        <div>
          <div className="profile-eyebrow">YOUR SPACE</div>
          <h1>
            Your profile<span>.</span>
          </h1>
          <p>Make FOCENTRA feel like yours.</p>
        </div>

        <div className="profile-settings-wrap">
          <button
            className={`profile-settings-button ${settingsOpen ? 'is-open' : ''}`}
            onClick={() => setSettingsOpen((value) => !value)}
            aria-expanded={settingsOpen}
            aria-label="Open profile settings"
            title="Profile settings"
            type="button"
          >
            <Settings2 size={18} />
            <span>Settings</span>
            <ChevronDown size={14} />
          </button>
        </div>
      </div>

      <section className="profile-hero-card glass-card">
        <div className="profile-orb profile-orb-one" />
        <div className="profile-orb profile-orb-two" />

        <div className="profile-identity-row">
          <div className="profile-picture-wrap">
            {avatarUrl ? (
              <img
                className="profile-picture"
                src={avatarUrl}
                alt="Your profile"
              />
            ) : (
              <div className="profile-picture profile-picture-fallback">
                {initials}
              </div>
            )}

            <button
              className="profile-camera-button"
              aria-label="Change profile picture"
              title="Change profile picture"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              type="button"
            >
              <Camera size={15} />
            </button>

            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(event) => void uploadAvatar(event)}
              hidden
            />
          </div>

          <div className="profile-identity-copy">
            <span className="profile-member-pill">
              <ShieldCheck size={13} /> FOCENTRA MEMBER
            </span>
            <h2>{name || displayName}</h2>
            <p>@{username || 'student'}</p>
            <div className="profile-email-line">
              <Mail size={14} />
              {session.user.email || 'No email address'}
              <span
                className="profile-verified-dot"
                title="Signed-in account"
              />
            </div>
          </div>

          <button
            className={`profile-edit-button ${editing ? 'editing' : ''}`}
            onClick={() => {
              setEditing((value) => !value)
              setError('')
              setMessage('')
              setUsername(
                profile?.username ??
                  session.user.user_metadata?.username ??
                  session.user.email?.split('@')[0] ??
                  '',
              )
              setName(profile?.display_name ?? displayName)
              setNewEmail(session.user.email ?? '')
            }}
            aria-label={
              editing ? 'Cancel editing profile' : 'Edit profile'
            }
            title={editing ? 'Cancel edit' : 'Edit profile'}
            type="button"
          >
            {editing ? <X size={17} /> : <Pencil size={17} />}
            <span>{editing ? 'Cancel' : 'Edit profile'}</span>
          </button>
        </div>

        {editing && (
          <form
            className="profile-edit-form"
            onSubmit={(event) => void saveProfile(event)}
          >
            <div className="profile-form-grid">
              <label>
                Username
                <input
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  minLength={3}
                  maxLength={30}
                  required
                  autoComplete="username"
                />
                <small>
                  Letters, numbers, dots, underscores and hyphens.
                </small>
              </label>

              <label>
                Display name
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={60}
                  required
                />
              </label>

              <label className="profile-form-full">
                Email address
                <input
                  type="email"
                  value={newEmail}
                  onChange={(event) => setNewEmail(event.target.value)}
                  required
                  autoComplete="email"
                />
                <small>
                  Changing this sends a confirmation email. Your account
                  email will change after confirmation.
                </small>
              </label>
            </div>

            <button
              className="profile-primary-button"
              type="submit"
              disabled={saving}
            >
              <Save size={15} />
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </form>
        )}

        {uploading && (
          <div className="profile-inline-note">
            Uploading your picture…
          </div>
        )}

        {message && (
          <div className="profile-success" role="status">
            <Check size={15} />
            {message}
          </div>
        )}

        {error && (
          <div className="profile-error" role="alert">
            {error}
          </div>
        )}

        <div className="profile-card-foot">
          <span>
            <CircleUserRound size={15} /> Personal account
          </span>
          <span>
            <BellOff size={14} />
            {doNotDisturb
              ? 'Do Not Disturb is on'
              : 'Notifications available'}
          </span>
        </div>
      </section>

      {settingsOpen && (
        <div className="profile-settings-panel glass-card">
          <div className="profile-settings-panel-heading">
            <div>
              <span className="profile-eyebrow">QUICK CONTROLS</span>
              <h2>Personal settings</h2>
            </div>
            <button
              className="profile-icon-button"
              onClick={() => setSettingsOpen(false)}
              aria-label="Close settings"
              type="button"
            >
              <X size={17} />
            </button>
          </div>

          <div className="profile-setting-row">
            <div className="profile-setting-icon">
              <BellOff size={17} />
            </div>
            <div className="profile-setting-copy">
              <strong>Do Not Disturb</strong>
              <span>Show friends that you're focusing.</span>
            </div>
            <button
              className={`profile-switch ${doNotDisturb ? 'active' : ''}`}
              onClick={onToggleDnd}
              disabled={dndLoading}
              aria-pressed={doNotDisturb}
              type="button"
            >
              <span />
              {dndLoading
                ? 'Saving'
                : doNotDisturb
                  ? 'On'
                  : 'Off'}
            </button>
          </div>

          <div className="profile-setting-row">
            <div className="profile-setting-icon">
              <KeyRound size={17} />
            </div>
            <div className="profile-setting-copy">
              <strong>Change password</strong>
              <span>Choose a new account password.</span>
            </div>
            <button
              className="profile-secondary-button"
              onClick={() => setShowPassword((value) => !value)}
              type="button"
            >
              {showPassword ? 'Close' : 'Change'}
              <ChevronDown size={14} />
            </button>
          </div>

          {showPassword && (
            <form
              className="profile-password-form"
              onSubmit={(event) => void changePassword(event)}
            >
              <label>
                New password
                <input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </label>

              <label>
                Confirm new password
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(event) =>
                    setConfirmPassword(event.target.value)
                  }
                  minLength={8}
                  autoComplete="new-password"
                  required
                />
              </label>

              <button
                className="profile-primary-button"
                type="submit"
                disabled={saving}
              >
                {saving ? 'Updating…' : 'Update password'}
              </button>
            </form>
          )}

          <div
            className="profile-themes-toggle dark-mode-fixed"
            aria-label="Appearance: dark mode enabled"
          >
            <span className="profile-setting-icon">
              <Moon size={17} />
            </span>
            <span>
              <strong>Dark mode</strong>
              <small>
                FOCENTRA uses its standard dark appearance. Light mode and
                theme switching are disabled.
              </small>
            </span>
            <span className="dark-mode-status">ON</span>
          </div>
        </div>
      )}

      {!settingsOpen && (
        <button
          className="profile-settings-nudge"
          onClick={() => setSettingsOpen(true)}
          type="button"
        >
          <Settings2 size={16} />
          View status and security settings
          <ChevronDown size={14} />
        </button>
      )}
    </div>
  )
}

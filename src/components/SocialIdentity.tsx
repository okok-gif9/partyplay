import { BadgeCheck, Compass, Cuboid, Flag, Orbit, ShieldCheck, Sparkles, Star, Triangle } from 'lucide-react'

export const avatarOptions = [
  { id: 'mint', label: 'مدار مِینت', variant: 'orbit', premiumOnly: false },
  { id: 'coral', label: 'ماسک مرجانی', variant: 'mask', premiumOnly: false },
  { id: 'sky', label: 'بادبادک آسمانی', variant: 'kite', premiumOnly: false },
  { id: 'sun', label: 'خورشید', variant: 'sun', premiumOnly: false },
  { id: 'orchid', label: 'گل ارغوانی', variant: 'petal', premiumOnly: false },
  { id: 'lime', label: 'صاعقه لیمویی', variant: 'bolt', premiumOnly: false },
  { id: 'peach', label: 'هلال هلویی', variant: 'crescent', premiumOnly: false },
  { id: 'navy', label: 'فضانورد شبانه', variant: 'helmet', premiumOnly: false },
  { id: 'berry', label: 'ربات بری', variant: 'bot', premiumOnly: false },
  { id: 'aqua', label: 'موج دریایی', variant: 'wave', premiumOnly: false },
  { id: 'plum', label: 'منشور آلویی', variant: 'prism', premiumOnly: false },
  { id: 'mango', label: 'قلب مانگو', variant: 'heart', premiumOnly: false },
  { id: 'nova', label: 'نووا', variant: 'nova', premiumOnly: true },
  { id: 'royal', label: 'رویال', variant: 'royal', premiumOnly: true },
  { id: 'comet', label: 'دنباله‌دار', variant: 'comet', premiumOnly: true },
  { id: 'prism', label: 'منشور ویژه', variant: 'prism-premium', premiumOnly: true },
] as const

export const groupBadgeOptions = [
  { id: 'ring', label: 'حلقه', icon: Orbit }, { id: 'flag', label: 'پرچم', icon: Flag },
  { id: 'planet', label: 'سیاره', icon: Sparkles }, { id: 'cube', label: 'مکعب', icon: Cuboid },
  { id: 'star', label: 'ستاره', icon: Star }, { id: 'compass', label: 'قطب‌نما', icon: Compass },
  { id: 'spark', label: 'جرقه', icon: Sparkles }, { id: 'prism', label: 'منشور', icon: Triangle },
] as const

export type AvatarSeed = typeof avatarOptions[number]['id']
export type GroupBadgeSeed = typeof groupBadgeOptions[number]['id']
export type IdentityTier = 'standard' | 'premium'
export type SiteRole = 'member' | 'site_admin'

export type IdentityMeta = {
  isVerified?: boolean
  membershipTier?: IdentityTier
  siteRole?: SiteRole
  tagline?: string
}

type PlayerAvatarProps = {
  seed?: string | null
  label: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  status?: 'online' | 'away' | 'busy' | 'offline'
  className?: string
}

export function PlayerAvatar({ seed = 'mint', label, size = 'md', status, className = '' }: PlayerAvatarProps) {
  const option = avatarOptions.find((candidate) => candidate.id === seed) || avatarOptions[0]
  return <span className={`identity-avatar avatar-${option.id} avatar-variant-${option.variant} avatar-${size} ${status && status !== 'offline' ? `avatar-status-${status}` : ''} ${className}`} aria-label={`آواتار ${label}: ${option.label}`} role="img"><i className="avatar-aura"/><i className="avatar-core"/><i className="avatar-hair"/><i className="avatar-eye avatar-eye-right"/><i className="avatar-eye avatar-eye-left"/><i className="avatar-mouth"/>{status && status !== 'offline' && <b className="avatar-presence"/>}</span>
}

export function IdentityLabel({ label, isVerified = false, membershipTier = 'standard', siteRole = 'member', tagline, compact = false }: { label: string; isVerified?: boolean; membershipTier?: IdentityTier; siteRole?: SiteRole; tagline?: string; compact?: boolean }) {
  const hasAdminRole = siteRole === 'site_admin'
  const hasPremiumRole = !hasAdminRole && (isVerified || membershipTier === 'premium')
  return <span className={`identity-label ${compact ? 'identity-label-compact' : ''}`}><strong>{label}</strong>{hasAdminRole && <em className="identity-role identity-role-admin"><ShieldCheck size={compact ? 12 : 14}/>مدیر سایت</em>}{hasPremiumRole && <em className="identity-role identity-role-premium"><BadgeCheck size={compact ? 12 : 14}/>ویژه</em>}{tagline && <small className="identity-tagline">{tagline}</small>}</span>
}

type GroupBadgeProps = { seed?: string | null; size?: 'sm' | 'md' | 'lg'; className?: string }
export function GroupBadge({ seed = 'ring', size = 'md', className = '' }: GroupBadgeProps) {
  const option = groupBadgeOptions.find((item) => item.id === seed) || groupBadgeOptions[0]
  const Icon = option.icon
  return <span className={`group-badge group-${option.id} group-badge-${size} ${className}`} aria-label={`نشان گروه ${option.label}`} role="img"><Icon/></span>
}

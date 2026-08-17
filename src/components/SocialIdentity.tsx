import { Compass, Cuboid, Flag, Orbit, Sparkles, Star, Triangle } from 'lucide-react'

export const avatarOptions = [
  { id: 'mint', label: 'مینت' }, { id: 'coral', label: 'مرجانی' }, { id: 'sky', label: 'آسمانی' },
  { id: 'sun', label: 'آفتابی' }, { id: 'orchid', label: 'ارغوانی' }, { id: 'lime', label: 'لیمویی' },
  { id: 'peach', label: 'هلویی' }, { id: 'navy', label: 'شبانه' }, { id: 'berry', label: 'بری' },
  { id: 'aqua', label: 'دریایی' }, { id: 'plum', label: 'آلویی' }, { id: 'mango', label: 'مانگو' },
] as const

export const groupBadgeOptions = [
  { id: 'ring', label: 'حلقه', icon: Orbit }, { id: 'flag', label: 'پرچم', icon: Flag },
  { id: 'planet', label: 'سیاره', icon: Sparkles }, { id: 'cube', label: 'مکعب', icon: Cuboid },
  { id: 'star', label: 'ستاره', icon: Star }, { id: 'compass', label: 'قطب‌نما', icon: Compass },
  { id: 'spark', label: 'جرقه', icon: Sparkles }, { id: 'prism', label: 'منشور', icon: Triangle },
] as const

export type AvatarSeed = typeof avatarOptions[number]['id']
export type GroupBadgeSeed = typeof groupBadgeOptions[number]['id']

type PlayerAvatarProps = {
  seed?: string | null
  label: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  status?: 'online' | 'away' | 'busy' | 'offline'
  className?: string
}

export function PlayerAvatar({ seed = 'mint', label, size = 'md', status, className = '' }: PlayerAvatarProps) {
  const safeSeed = avatarOptions.some((option) => option.id === seed) ? seed : 'mint'
  return <span className={`identity-avatar avatar-${safeSeed} avatar-${size} ${status && status !== 'offline' ? `avatar-status-${status}` : ''} ${className}`} aria-label={`آواتار ${label}`} role="img"><i className="avatar-hair"/><i className="avatar-eye avatar-eye-right"/><i className="avatar-eye avatar-eye-left"/><i className="avatar-mouth"/>{status && status !== 'offline' && <b className="avatar-presence"/>}</span>
}

type GroupBadgeProps = { seed?: string | null; size?: 'sm' | 'md' | 'lg'; className?: string }
export function GroupBadge({ seed = 'ring', size = 'md', className = '' }: GroupBadgeProps) {
  const option = groupBadgeOptions.find((item) => item.id === seed) || groupBadgeOptions[0]
  const Icon = option.icon
  return <span className={`group-badge group-${option.id} group-badge-${size} ${className}`} aria-label={`نشان گروه ${option.label}`} role="img"><Icon/></span>
}

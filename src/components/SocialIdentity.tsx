import { BadgeCheck, Compass, Cuboid, Flag, Orbit, ShieldCheck, Sparkles, Star, Triangle } from 'lucide-react'
import mintAvatar from '../assets/avatars/mint.png'
import coralAvatar from '../assets/avatars/coral.png'
import skyAvatar from '../assets/avatars/sky.png'
import sunAvatar from '../assets/avatars/sun.png'
import orchidAvatar from '../assets/avatars/orchid.png'
import limeAvatar from '../assets/avatars/lime.png'
import peachAvatar from '../assets/avatars/peach.png'
import navyAvatar from '../assets/avatars/navy.png'
import berryAvatar from '../assets/avatars/berry.png'
import aquaAvatar from '../assets/avatars/aqua.png'
import plumAvatar from '../assets/avatars/plum.png'
import mangoAvatar from '../assets/avatars/mango.png'
import novaAvatar from '../assets/avatars/nova.png'
import royalAvatar from '../assets/avatars/royal.png'
import cometAvatar from '../assets/avatars/comet.png'
import prismAvatar from '../assets/avatars/prism.png'

export const avatarOptions = [
  { id: 'mint', label: 'گیمر نقاب‌دار', variant: 'gamer', premiumOnly: false, asset: mintAvatar },
  { id: 'coral', label: 'روباه هدست‌دار', variant: 'fox', premiumOnly: false, asset: coralAvatar },
  { id: 'sky', label: 'پنگوئن استریمر', variant: 'penguin', premiumOnly: false, asset: skyAvatar },
  { id: 'sun', label: 'ربات روشن', variant: 'robot', premiumOnly: false, asset: sunAvatar },
  { id: 'orchid', label: 'جغد بازیگوش', variant: 'owl', premiumOnly: false, asset: orchidAvatar },
  { id: 'lime', label: 'کوسهٔ خندان', variant: 'shark', premiumOnly: false, asset: limeAvatar },
  { id: 'peach', label: 'فضانورد کوچک', variant: 'astronaut', premiumOnly: false, asset: peachAvatar },
  { id: 'navy', label: 'گربهٔ استراتژیست', variant: 'cat', premiumOnly: false, asset: navyAvatar },
  { id: 'berry', label: 'ربات بری', variant: 'robot-berry', premiumOnly: false, asset: berryAvatar },
  { id: 'aqua', label: 'سمور دریایی', variant: 'otter', premiumOnly: false, asset: aquaAvatar },
  { id: 'plum', label: 'آفتاب‌پرست هنرمند', variant: 'chameleon', premiumOnly: false, asset: plumAvatar },
  { id: 'mango', label: 'اژدهای کوچولو', variant: 'dragon', premiumOnly: false, asset: mangoAvatar },
  { id: 'nova', label: 'پاندای قهرمان', variant: 'panda', premiumOnly: true, asset: novaAvatar },
  { id: 'royal', label: 'گربهٔ سلطنتی', variant: 'royal-cat', premiumOnly: true, asset: royalAvatar },
  { id: 'comet', label: 'سنجاب استریمر', variant: 'squirrel', premiumOnly: true, asset: cometAvatar },
  { id: 'prism', label: 'خرس قطبی ویژه', variant: 'polar-bear', premiumOnly: true, asset: prismAvatar },
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

export type IdentityMeta = { isVerified?: boolean; membershipTier?: IdentityTier; siteRole?: SiteRole; tagline?: string }

type PlayerAvatarProps = { seed?: string | null; label: string; size?: 'sm' | 'md' | 'lg' | 'xl'; status?: 'online' | 'away' | 'busy' | 'offline'; className?: string }

export function PlayerAvatar({ seed = 'mint', label, size = 'md', status, className = '' }: PlayerAvatarProps) {
  const option = avatarOptions.find((candidate) => candidate.id === seed) || avatarOptions[0]
  return <span className={`identity-avatar avatar-character avatar-${option.id} avatar-${size} ${status && status !== 'offline' ? `avatar-status-${status}` : ''} ${className}`} aria-label={`آواتار ${label}: ${option.label}`} role="img"><img src={option.asset} alt="" draggable={false}/>{status && status !== 'offline' && <b className="avatar-presence"/>}</span>
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

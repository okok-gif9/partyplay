import { useState } from 'react'
import { CheckCircle2, Flag, LoaderCircle, SearchCheck } from 'lucide-react'
import type { AdminCommunityReport } from '../lib/partyplay'
import { PlayerAvatar } from './SocialIdentity'

const categories: Record<string, { fa: string; en: string }> = {
  harassment: { fa: 'آزار و مزاحمت', en: 'Harassment' }, spam: { fa: 'اسپم', en: 'Spam' }, cheating: { fa: 'تقلب', en: 'Cheating' }, inappropriate_content: { fa: 'محتوای نامناسب', en: 'Inappropriate content' }, other: { fa: 'سایر', en: 'Other' },
}

export default function AdminReportQueue({ reports, busy, fa, onReview }: { reports: AdminCommunityReport[]; busy: boolean; fa: boolean; onReview: (input: { reportId: string; status: 'reviewing' | 'closed'; note: string }) => Promise<unknown> }) {
  const [notes, setNotes] = useState<Record<string, string>>({})
  const [activeId, setActiveId] = useState<string | null>(null)
  const process = async (report: AdminCommunityReport, status: 'reviewing' | 'closed') => {
    const note = (notes[report.id] || '').trim()
    if (note.length < 8) return
    setActiveId(report.id)
    try { await onReview({ reportId: report.id, status, note }); setNotes((current) => ({ ...current, [report.id]: '' })) }
    finally { setActiveId(null) }
  }
  return <article className="admin-panel admin-report-queue"><div className="admin-panel-heading"><div><span className="eyebrow"><Flag size={14}/>{fa ? 'ایمنی جامعه' : 'Community safety'}</span><h2>{fa ? 'گزارش‌های باز کاربران' : 'Open user reports'}</h2></div><span className="admin-report-count">{reports.length}</span></div>{reports.length ? <div className="admin-report-list">{reports.map((report) => { const pending = busy && activeId === report.id; return <article key={report.id}><div className="admin-report-head"><span className="admin-report-category">{categories[report.category]?.[fa ? 'fa' : 'en'] || report.category}</span><small>{new Intl.DateTimeFormat(fa ? 'fa-IR' : 'en-US', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(report.created_at))}</small></div><p>{report.details}</p><div className="admin-report-people"><span><PlayerAvatar seed={report.reporter.avatar_seed} label={report.reporter.display_name} size="sm"/><b>{fa ? 'گزارشگر:' : 'Reporter:'}</b> @{report.reporter.username}</span><span><PlayerAvatar seed={report.target.avatar_seed} label={report.target.display_name} size="sm"/><b>{fa ? 'گزارش‌شده:' : 'Reported:'}</b> @{report.target.username}</span></div><textarea value={notes[report.id] || ''} onChange={(event) => setNotes((current) => ({ ...current, [report.id]: event.target.value }))} placeholder={fa ? 'یادداشت رسیدگی؛ حداقل ۸ نویسه' : 'Resolution note; at least 8 characters'} minLength={8} maxLength={280}/><div className="admin-report-actions"><button className="secondary-button" disabled={pending || (notes[report.id] || '').trim().length < 8} onClick={() => void process(report, 'reviewing')}>{pending ? <LoaderCircle size={15}/> : <SearchCheck size={15}/>}{fa ? 'در حال رسیدگی' : 'Mark reviewing'}</button><button className="primary-button" disabled={pending || (notes[report.id] || '').trim().length < 8} onClick={() => void process(report, 'closed')}>{pending ? <LoaderCircle size={15}/> : <CheckCircle2 size={15}/>}{fa ? 'بستن گزارش' : 'Close report'}</button></div></article> })}</div> : <div className="admin-report-empty"><CheckCircle2 size={25}/><p>{fa ? 'گزارش بازی برای رسیدگی نداری.' : 'There are no open reports to review.'}</p></div>}</article>
}

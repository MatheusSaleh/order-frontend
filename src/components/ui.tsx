import clsx from 'clsx'
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export function Card({ title, icon, action, children, className }: {
  title?: ReactNode
  icon?: ReactNode
  action?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={clsx('glass p-4', className)}>
      {title && (
        <header className="mb-3 flex items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-100">
            {icon}
            {title}
          </h2>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost'

export function Button({ variant = 'secondary', className, children, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant
}) {
  return (
    <button
      type="button"
      {...props}
      className={clsx(
        'inline-flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition',
        'disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-300',
        variant === 'primary' &&
          'bg-gradient-to-r from-sky-400 to-violet-400 text-slate-950 shadow-lg shadow-sky-500/20 hover:brightness-110',
        variant === 'secondary' && 'border border-white/10 bg-white/5 text-slate-100 hover:bg-white/10',
        variant === 'danger' && 'border border-rose-400/30 bg-rose-500/10 text-rose-200 hover:bg-rose-500/20',
        variant === 'ghost' && 'text-slate-300 hover:bg-white/5 hover:text-white',
        className,
      )}
    >
      {children}
    </button>
  )
}

export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={clsx(
        'relative h-6 w-11 shrink-0 rounded-full transition focus-visible:outline-2 focus-visible:outline-sky-300',
        checked ? 'bg-emerald-400' : 'bg-white/15',
      )}
    >
      <span
        className={clsx(
          'absolute top-0.5 size-5 rounded-full bg-white shadow transition-all',
          checked ? 'left-[22px]' : 'left-0.5',
        )}
      />
    </button>
  )
}

export function Kbd({ children }: { children: ReactNode }) {
  return <code className="rounded-md bg-white/10 px-1.5 py-0.5 font-mono text-[11px] text-slate-200">{children}</code>
}

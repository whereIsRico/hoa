export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center gap-3 py-16 text-center">
      {Icon && (
        <div className="flex size-12 items-center justify-center rounded-full bg-accent-100 dark:bg-accent-900/30">
          <Icon size={22} className="text-accent-600 dark:text-accent-300" />
        </div>
      )}
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">{title}</p>
        {description && <p className="text-sm text-neutral-500 dark:text-neutral-400">{description}</p>}
      </div>
      {action}
    </div>
  )
}

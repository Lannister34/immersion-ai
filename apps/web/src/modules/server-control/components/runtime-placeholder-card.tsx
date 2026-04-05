import type { ProviderMode } from '@immersion/contracts/providers';

import { SummaryCard } from '../../../shared/ui/summary-card';

interface RuntimePlaceholderCardProps {
  mode: ProviderMode;
}

export function RuntimePlaceholderCard({ mode }: RuntimePlaceholderCardProps) {
  return (
    <SummaryCard
      eyebrow="runtime"
      title="Встроенный runtime"
      description="Управление локальным runtime переносится отдельным sub-slice после стабилизации provider settings."
    >
      <p className="summary-card__muted">
        {mode === 'builtin'
          ? 'Сейчас builtin mode уже сохраняется канонически, но запуск, остановка, выбор модели и логи ещё не перенесены.'
          : 'Для внешнего режима runtime-панель намеренно скрыта. Следующим шагом сюда придёт только read-only overview builtin runtime.'}
      </p>
    </SummaryCard>
  );
}

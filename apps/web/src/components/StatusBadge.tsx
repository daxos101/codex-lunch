import type { MenuStatus } from '@lunch/shared/contracts';

import { STATUS_CONTENT } from '../format';
import { CheckIcon, ClockIcon } from './Icons';

export function StatusBadge({ status }: { status: MenuStatus }) {
  const content = STATUS_CONTENT[status];
  const Icon = status === 'confirmed_today' ? CheckIcon : ClockIcon;

  return (
    <span className={`status-badge status-badge--${content.tone}`}>
      <Icon />
      {content.label}
    </span>
  );
}

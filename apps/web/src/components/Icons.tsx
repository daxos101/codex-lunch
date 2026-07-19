import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      aria-hidden="true"
      fill="none"
      height="20"
      viewBox="0 0 24 24"
      width="20"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ArrowIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M5 12h14M14 7l5 5-5 5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.8"
      />
    </Icon>
  );
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="m5.5 12.5 4 4 9-9"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="2"
      />
    </Icon>
  );
}

export function ClockIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="12" r="8.5" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="M12 7.5V12l3 2"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </Icon>
  );
}

export function ExternalIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M13 5h6v6M19 5l-8 8"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <path
        d="M17 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V8a1 1 0 0 1 1-1h5"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </Icon>
  );
}

export function LocationIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path
        d="M19 10c0 5-7 10-7 10S5 15 5 10a7 7 0 1 1 14 0Z"
        stroke="currentColor"
        strokeLinejoin="round"
        strokeWidth="1.7"
      />
      <circle cx="12" cy="10" r="2.3" stroke="currentColor" strokeWidth="1.7" />
    </Icon>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="10.5" cy="10.5" r="6" stroke="currentColor" strokeWidth="1.7" />
      <path
        d="m15 15 4 4"
        stroke="currentColor"
        strokeLinecap="round"
        strokeWidth="1.7"
      />
    </Icon>
  );
}

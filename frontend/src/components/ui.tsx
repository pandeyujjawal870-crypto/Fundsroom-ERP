import type { ReactNode } from "react";

export const StatusBadge = ({ status }: { status?: string | null }) => {
	const label = status?.trim() || "UNKNOWN";
	return <span className={`status status-${label.toLowerCase()}`}>{label}</span>;
};
export const LoadingState = ({ label = "Loading records..." }: { label?: string }) => <div className="state-panel loading-state"><span className="loader" />{label}</div>;
export const EmptyState = ({ title, action }: { title: string; action?: ReactNode }) => <div className="state-panel"><strong>{title}</strong>{action}</div>;
export const ErrorNotice = ({ message }: { message: string }) => <div className="notice notice-error" role="alert">{message}</div>;
export const SuccessNotice = ({ message }: { message: string }) => <div className="notice notice-success" role="status">{message}</div>;
export const PageHeader = ({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) => <div className="page-header"><div><span className="eyebrow">{eyebrow}</span><h1>{title}</h1><p>{description}</p></div>{action}</div>;
export const Field = ({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) => <label className="field"><span>{label}{required && <b aria-hidden="true"> *</b>}</span>{children}</label>;

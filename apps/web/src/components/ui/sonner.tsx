import { Toaster as Sonner, ToasterProps } from "sonner"
import { CheckCircle2, XCircle, AlertTriangle, Info, Loader2 } from "lucide-react"

const Toaster = ({ ...props }: ToasterProps) => {
  return (
    <Sonner
      theme="light"
      position="bottom-right"
      gap={8}
      closeButton
      toastOptions={{
        style: {
          background: "#ffffff",
          border: "1px solid #e5e7eb",
          borderRadius: "4px",
          boxShadow: "0 2px 8px 0 rgba(0,0,0,0.08), 0 0 0 1px rgba(0,0,0,0.04)",
          padding: "12px 16px",
          fontSize: "13px",
          fontWeight: 400,
          color: "#111827",
          minWidth: "320px",
          maxWidth: "420px",
        },
        classNames: {
          title: "font-medium text-[13px] leading-snug",
          description: "text-[12px] text-gray-500 mt-0.5",
          actionButton: "text-[12px]",
        },
      }}
      icons={{
        success: (
          <CheckCircle2
            size={15}
            strokeWidth={2}
            className="shrink-0 text-green-600"
          />
        ),
        error: (
          <XCircle
            size={15}
            strokeWidth={2}
            className="shrink-0 text-red-600"
          />
        ),
        warning: (
          <AlertTriangle
            size={15}
            strokeWidth={2}
            className="shrink-0 text-amber-500"
          />
        ),
        info: (
          <Info
            size={15}
            strokeWidth={2}
            className="shrink-0 text-blue-600"
          />
        ),
        loading: (
          <Loader2
            size={15}
            strokeWidth={2}
            className="shrink-0 text-gray-400 animate-spin"
          />
        ),
      }}
      {...props}
    />
  )
}

export { Toaster }

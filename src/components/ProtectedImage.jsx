export default function ProtectedImage({ className = '', ...props }) {
  return (
    <img
      className={`select-none protected-image ${className}`.trim()}
      {...props}
    />
  )
}

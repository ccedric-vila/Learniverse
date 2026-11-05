import { GoogleLogin, GoogleOAuthProvider } from '@react-oauth/google'

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID

export default function GoogleSignInButton({ onSuccess, onError }) {
  if (!clientId) return null

  return (
    <div className="auth-google-button">
      <GoogleOAuthProvider clientId={clientId}>
        <GoogleLogin
          onSuccess={(response) => {
            if (!response.credential) {
              onError('Google did not return a sign-in credential. Please try again.')
              return
            }
            onSuccess(response.credential)
          }}
          onError={() => onError('Google sign-in failed. Please try again.')}
          theme="outline"
          size="large"
          shape="rectangular"
          text="continue_with"
          width="320"
        />
      </GoogleOAuthProvider>
    </div>
  )
}

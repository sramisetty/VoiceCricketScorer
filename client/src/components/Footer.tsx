export default function Footer() {
  return (
    <footer className="mt-auto border-t bg-white">
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          <img 
            src="/ramisetty-logo.png" 
            alt="ramisetty.net logo" 
            className="h-16 w-auto"
          />
          <span className="text-sm text-gray-600">
            © 2025 ramisetty.net. All rights reserved.
          </span>
        </div>
      </div>
    </footer>
  );
}
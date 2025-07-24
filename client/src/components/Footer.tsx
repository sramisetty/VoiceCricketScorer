export default function Footer() {
  return (
    <footer className="bg-gray-100 border-t border-gray-200 py-6 mt-auto">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <img 
              src="/ramisetty-logo.png" 
              alt="Ramisetty.net" 
              className="h-8 w-auto"
            />
          </div>
          <div className="text-sm text-gray-600">
            © 2025 ramisetty.net. All rights reserved.
          </div>
        </div>
      </div>
    </footer>
  );
}
import React from 'react';
import { createRoot } from 'react-dom/client';

const App = () => {
  return (
    <div className="min-h-screen">
      <header className="bg-blue-900 text-white p-4">
        <div className="container mx-auto flex justify-between items-center">
          <h1 className="text-2xl font-bold">Onspec Precision Machining</h1>
          <nav className="flex space-x-4">
            <a href="/" className="hover:text-blue-300">Home</a>
            <a href="/services" className="hover:text-blue-300">Services</a>
            <a href="/about" className="hover:text-blue-300">About</a>
            <a href="/contact" className="hover:text-blue-300">Contact</a>
          </nav>
        </div>
      </header>

      <main className="container mx-auto p-4">
        <h2 className="text-3xl font-bold mb-6">Welcome to Onspec Precision Machining</h2>
        <p className="mb-4">Precision engineering solutions for aerospace, automotive, medical and industrial sectors.</p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8">
          <div className="bg-gray-100 p-4 rounded">
            <h3 className="font-bold text-lg mb-2">Precision Machining</h3>
            <p>High-precision CNC machining with tight tolerances.</p>
          </div>
          <div className="bg-gray-100 p-4 rounded">
            <h3 className="font-bold text-lg mb-2">Quality Assurance</h3>
            <p>Comprehensive inspection and testing of all components.</p>
          </div>
          <div className="bg-gray-100 p-4 rounded">
            <h3 className="font-bold text-lg mb-2">Fast Delivery</h3>
            <p>Timely delivery with flexible scheduling options.</p>
          </div>
        </div>
      </main>

      <footer className="bg-gray-800 text-white p-6 mt-12">
        <div className="container mx-auto">
          <p>&copy; {new Date().getFullYear()} Onspec Precision Machining. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

const root = createRoot(document.getElementById('root'));
root.render(<App />);
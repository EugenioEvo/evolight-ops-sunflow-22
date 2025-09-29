import { Sun, Zap, MapPin } from "lucide-react";

const Header = () => {
  return (
    <header className="bg-gradient-to-r from-primary to-secondary p-6 shadow-solar">
      <div className="container mx-auto flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="relative">
            <Sun className="h-10 w-10 text-white animate-pulse" />
            <Zap className="h-4 w-4 text-yellow-300 absolute -top-1 -right-1" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-white">Evolight</h1>
            <p className="text-blue-100 text-sm">Solar O&M Control System</p>
          </div>
        </div>
        <div className="flex items-center space-x-4 text-white">
          <MapPin className="h-5 w-5" />
          <span className="font-medium">Route Optimization Active</span>
        </div>
      </div>
    </header>
  );
};

export default Header;
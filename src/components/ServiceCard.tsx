
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowRight } from "lucide-react";
import ServiceCostDisplay from "./ServiceCostDisplay";

interface ServiceCardProps {
  title: string;
  description: string;
  icon: React.ReactNode;
  action: string;
  color: string;
  cost?: number;
  href?: string;
  link?: string;
  youtubeId?: string;
}

const ServiceCard = ({ title, description, icon, action, color, cost, href, link, youtubeId }: ServiceCardProps) => {
  const [isHovered, setIsHovered] = useState(false);
  const navigateTo = href || link || '#';

  return (
    <Card 
      className={`transition-all duration-300 ${
        isHovered ? "shadow-lg translate-y-[-4px]" : "shadow-md"
      } border-t-4 overflow-hidden`}
      style={{ borderTopColor: color }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div 
        className={`absolute top-0 right-0 w-24 h-24 rounded-full filter blur-xl opacity-10 transition-all duration-300 ${
          isHovered ? "scale-125" : "scale-100"
        }`} 
        style={{ backgroundColor: color }}
      ></div>
      
      <CardHeader className="relative z-10">
        <div className="flex justify-between items-start">
          <div 
            className="p-3 rounded-lg"
            style={{ backgroundColor: `${color}20` }}
          >
            {icon}
          </div>
          {cost !== undefined && <ServiceCostDisplay cost={cost} />}
        </div>
        <CardTitle className="mt-4">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      
      <CardContent className="relative z-10">
        {youtubeId ? (
          <div className="aspect-video w-full rounded-lg overflow-hidden">
            <iframe
              width="100%"
              height="100%"
              src={`https://www.youtube.com/embed/${youtubeId}`}
              title="YouTube video player"
              frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen
            ></iframe>
          </div>
        ) : (
          <div className="h-16 flex items-center justify-center border border-gray-200 rounded-lg bg-gray-50">
            <p className="text-sm text-muted-foreground">Content preview area</p>
          </div>
        )}
      </CardContent>
      
      <CardFooter className="relative z-10">
        <Button 
          className="w-full group flex items-center justify-center transition-all"
          style={{ 
            backgroundColor: isHovered ? color : 'white',
            color: isHovered ? 'white' : 'black',
            borderColor: color
          }}
          variant={isHovered ? "default" : "outline"}
          asChild={!!navigateTo}
        >
          {navigateTo !== '#' ? (
            <a href={navigateTo}>
              {action}
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </a>
          ) : (
            <>
              {action}
              <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
            </>
          )}
        </Button>
      </CardFooter>
    </Card>
  );
};

export default ServiceCard;

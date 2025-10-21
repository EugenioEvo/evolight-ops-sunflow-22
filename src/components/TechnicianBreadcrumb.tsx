import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "@/components/ui/breadcrumb";
import { Home, ClipboardList, FileText } from "lucide-react";

interface TechnicianBreadcrumbProps {
  current: 'minhas-os' | 'rme' | 'agenda';
  osNumber?: string;
}

export const TechnicianBreadcrumb = ({ current, osNumber }: TechnicianBreadcrumbProps) => (
  <Breadcrumb className="mb-6">
    <BreadcrumbList>
      <BreadcrumbItem>
        <BreadcrumbLink href="/" className="flex items-center gap-1">
          <Home className="h-4 w-4" />
          <span className="hidden sm:inline">Início</span>
        </BreadcrumbLink>
      </BreadcrumbItem>
      <BreadcrumbSeparator />
      {current === 'minhas-os' && (
        <BreadcrumbItem>
          <BreadcrumbPage className="flex items-center gap-1">
            <ClipboardList className="h-4 w-4" />
            Minhas OS
          </BreadcrumbPage>
        </BreadcrumbItem>
      )}
      {current === 'agenda' && (
        <BreadcrumbItem>
          <BreadcrumbPage>Agenda</BreadcrumbPage>
        </BreadcrumbItem>
      )}
      {current === 'rme' && (
        <>
          <BreadcrumbItem>
            <BreadcrumbLink href="/minhas-os" className="flex items-center gap-1">
              <ClipboardList className="h-4 w-4" />
              <span className="hidden sm:inline">Minhas OS</span>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              RME {osNumber && <span className="hidden sm:inline">- {osNumber}</span>}
            </BreadcrumbPage>
          </BreadcrumbItem>
        </>
      )}
    </BreadcrumbList>
  </Breadcrumb>
);

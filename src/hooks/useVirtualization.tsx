import { useMemo } from 'react';

interface UseVirtualizationOptions {
  itemHeight?: number;
  maxHeight?: number;
  threshold?: number;
}

/**
 * Hook para determinar se virtualização deve ser usada baseado no tamanho dos dados
 * @param dataLength - Número de itens na lista
 * @param options - Configurações de virtualização
 * @returns Configurações otimizadas para virtualização
 */
export const useVirtualization = (
  dataLength: number,
  options: UseVirtualizationOptions = {}
) => {
  const {
    itemHeight = 56,
    maxHeight = 600,
    threshold = 50, // Habilita virtualização se > 50 itens
  } = options;

  return useMemo(() => {
    const shouldVirtualize = dataLength > threshold;
    const visibleItems = Math.ceil(maxHeight / itemHeight);
    const overscan = Math.min(10, Math.ceil(visibleItems / 2));

    return {
      shouldVirtualize,
      itemHeight,
      maxHeight,
      overscan,
      visibleItems,
      totalItems: dataLength,
    };
  }, [dataLength, threshold, itemHeight, maxHeight]);
};

export default useVirtualization;

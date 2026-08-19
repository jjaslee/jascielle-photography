import { Navigate, useParams } from 'react-router-dom'
import WorkCategoryGallery from '../components/work/WorkCategoryGallery'
import { getWorkCategoryPage } from '../data/workCategories'

export default function WorkCategory() {
  const { categoryId } = useParams()
  const category = getWorkCategoryPage(categoryId)

  if (!category) return <Navigate to="/work" replace />

  return <WorkCategoryGallery key={category.id} category={category} />
}
